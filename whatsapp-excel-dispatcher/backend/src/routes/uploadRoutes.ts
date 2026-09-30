import { Router, Request, Response } from 'express';
import { uploadExcel } from '../middleware/upload.js';
import { validateExcel, getPreviewRows } from '../services/excelValidator.js';
import { Campaign } from '../models/Campaign.js';
import { logger } from '../utils/logger.js';

const router = Router();

// POST /api/campaigns/upload — Upload and validate master Excel
router.post('/', uploadExcel.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const campaignName = req.body.name || req.file.originalname.replace(/\.[^/.]+$/, '');

    // Create campaign record
    const campaign = await Campaign.create({
      name: campaignName,
      originalFileName: req.file.originalname,
      masterFilePath: req.file.path,
      status: 'validating',
      createdBy: req.user!.userId,
    });

    logger.info(
      { campaignId: campaign._id, filename: req.file.originalname },
      'Excel upload started'
    );

    // If column mapping is provided, validate immediately
    if (req.body.columnMapping) {
      try {
        const mapping = JSON.parse(req.body.columnMapping);
        const result = await validateExcel(req.file.path, mapping);

        campaign.columnMapping = mapping;
        campaign.totalRecipients = result.totalRows;
        campaign.pending = result.totalRows;
        campaign.validationErrors = result.errors;
        campaign.status = result.isValid ? 'validated' : 'failed';
        await campaign.save();

        res.status(201).json({
          campaign: campaign.toJSON(),
          validation: {
            isValid: result.isValid,
            headers: result.headers,
            preview: getPreviewRows(result.rows),
            errors: result.errors,
            totalRows: result.totalRows,
          },
        });
        return;
      } catch {
        // If mapping parse fails, just return campaign for later mapping
      }
    }

    // Return campaign without validation — user will map columns next
    // Parse headers from the file for the column mapper
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.default.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const worksheet = workbook.getWorksheet(1);
    const headers: string[] = [];

    if (worksheet) {
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell({ includeEmpty: false }, (cell) => {
        const val = cell.value;
        if (val !== null && val !== undefined) {
          headers.push(String(val).trim());
        }
      });
    }

    campaign.status = 'validating'; // Still needs column mapping
    await campaign.save();

    res.status(201).json({
      campaign: campaign.toJSON(),
      headers,
    });
  } catch (error) {
    logger.error({ error }, 'Upload failed');
    res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;
