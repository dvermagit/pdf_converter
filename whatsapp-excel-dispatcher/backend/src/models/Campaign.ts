import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IValidationError {
  row: number;
  column: string;
  value: string;
  reason: string;
}

export type CampaignStatus =
  | 'validating'
  | 'validated'
  | 'processing'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** How the recipient list was built: an uploaded Excel, or typed into the form. */
export type CampaignSource = 'excel' | 'manual';

/** A campaign that repeats daily between two dates, at the same local time. */
export interface IRecurrence {
  mode: 'daily';
  startDate: string; // "YYYY-MM-DD" in the campaign timezone
  endDate: string; // inclusive
  time: string; // "HH:mm"
}

export interface ICampaign extends Document {
  name: string;
  originalFileName: string;
  masterFilePath: string;
  source: CampaignSource;
  templateId?: Types.ObjectId;
  /** Unrendered message body, so people added later re-render placeholders. */
  messageBody?: string;
  /**
   * Snapshot of the Meta template in force when the campaign was created.
   * Held here rather than read through `templateId` at send time so editing or
   * deleting a template cannot change messages already queued.
   */
  metaTemplate?: {
    templateName: string;
    languageCode: string;
    headerType: string;
  };
  eventDate?: Date;
  recurrence?: IRecurrence;
  status: CampaignStatus;
  timezone: string;
  totalRecipients: number;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  columnMapping: {
    recipientName: string;
    phoneNumber: string;
    dateOfBirth: string;
    message: string;
    scheduledAt: string;
    [key: string]: string;
  };
  selectedOutputColumns: string[];
  validationErrors: IValidationError[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const validationErrorSchema = new Schema<IValidationError>(
  {
    row: { type: Number, required: true },
    column: { type: String, required: true },
    value: { type: String, default: '' },
    reason: { type: String, required: true },
  },
  { _id: false }
);

const campaignSchema = new Schema<ICampaign>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Empty for manually-entered campaigns — there is no source workbook.
    originalFileName: {
      type: String,
      default: '',
    },
    masterFilePath: {
      type: String,
      default: '',
    },
    source: {
      type: String,
      enum: ['excel', 'manual'],
      default: 'excel',
      index: true,
    },
    templateId: {
      type: Schema.Types.ObjectId,
      ref: 'Template',
    },
    messageBody: {
      type: String,
      default: '',
    },
    metaTemplate: {
      type: new Schema(
        {
          templateName: { type: String, required: true },
          languageCode: { type: String, default: 'en' },
          headerType: { type: String, default: 'none' },
        },
        { _id: false }
      ),
      default: undefined,
    },
    eventDate: {
      type: Date,
    },
    recurrence: {
      type: new Schema<IRecurrence>(
        {
          mode: { type: String, enum: ['daily'], required: true },
          startDate: { type: String, required: true },
          endDate: { type: String, required: true },
          time: { type: String, required: true },
        },
        { _id: false }
      ),
      default: undefined,
    },
    status: {
      type: String,
      enum: [
        'validating',
        'validated',
        'processing',
        'scheduled',
        'in_progress',
        'completed',
        'failed',
        'cancelled',
      ],
      default: 'validating',
      index: true,
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    totalRecipients: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    columnMapping: {
      type: Schema.Types.Mixed,
      default: {},
    },
    selectedOutputColumns: {
      type: [String],
      default: [],
    },
    validationErrors: {
      type: [validationErrorSchema],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const { __v: _v, ...rest } = ret;
        return rest;
      },
    },
  }
);

// Compound index for listing campaigns by user
campaignSchema.index({ createdBy: 1, createdAt: -1 });

export const Campaign = mongoose.model<ICampaign>('Campaign', campaignSchema);
