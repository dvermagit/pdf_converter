import { useState, useCallback } from 'react';
import * as api from '../services/api';
import type { UploadResponse, ColumnMapping } from '../types';

interface UploadState {
  step: 'idle' | 'uploading' | 'mapping' | 'validating' | 'preview' | 'confirmed' | 'error';
  file: File | null;
  uploadResponse: UploadResponse | null;
  headers: string[];
  error: string | null;
  isLoading: boolean;
}

export function useUpload() {
  const [state, setState] = useState<UploadState>({
    step: 'idle',
    file: null,
    uploadResponse: null,
    headers: [],
    error: null,
    isLoading: false,
  });

  const uploadFile = useCallback(async (file: File, name?: string) => {
    setState((prev) => ({ ...prev, step: 'uploading', file, isLoading: true, error: null }));
    try {
      const response = await api.uploadCampaign(file, name);
      setState((prev) => ({
        ...prev,
        step: 'mapping',
        uploadResponse: response,
        headers: response.headers || [],
        isLoading: false,
      }));
      return response;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setState((prev) => ({ ...prev, step: 'error', error: message, isLoading: false }));
      throw err;
    }
  }, []);

  const validateMapping = useCallback(
    async (
      columnMapping: ColumnMapping,
      timezone: string,
      selectedOutputColumns: string[]
    ) => {
      if (!state.uploadResponse?.campaign._id) return;
      setState((prev) => ({ ...prev, step: 'validating', isLoading: true, error: null }));
      try {
        const response = await api.validateCampaign(
          state.uploadResponse.campaign._id,
          columnMapping,
          timezone,
          selectedOutputColumns
        );
        setState((prev) => ({
          ...prev,
          step: response.validation?.isValid ? 'preview' : 'error',
          uploadResponse: response,
          error: response.validation?.isValid
            ? null
            : `${response.validation?.errors.length} validation error(s) found`,
          isLoading: false,
        }));
        return response;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Validation failed';
        setState((prev) => ({ ...prev, step: 'error', error: message, isLoading: false }));
        throw err;
      }
    },
    [state.uploadResponse]
  );

  const reset = useCallback(() => {
    setState({
      step: 'idle',
      file: null,
      uploadResponse: null,
      headers: [],
      error: null,
      isLoading: false,
    });
  }, []);

  return {
    ...state,
    uploadFile,
    validateMapping,
    reset,
  };
}
