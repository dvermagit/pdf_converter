import mongoose, { Schema, Document, Types } from 'mongoose';

export type RecipientStatus =
  | 'pending'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export interface IRecipient extends Document {
  campaignId: Types.ObjectId;
  recipientName: string;
  phoneNumber: string;
  dateOfBirth?: Date;
  message: string;
  /**
   * Values for the Meta template's positional variables, resolved when the
   * campaign was built. Empty for free-form sends.
   */
  templateParams: string[];
  scheduledAt: Date;
  timezone: string;
  generatedFilePath: string;
  status: RecipientStatus;
  whatsappMessageId?: string;
  errorMessage?: string;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const recipientSchema = new Schema<IRecipient>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true,
    },
    recipientName: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
    },
    message: {
      type: String,
      required: true,
    },
    templateParams: {
      type: [String],
      default: [],
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    timezone: {
      type: String,
      required: true,
    },
    generatedFilePath: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'queued', 'sending', 'sent', 'delivered', 'read', 'failed'],
      default: 'pending',
      index: true,
    },
    whatsappMessageId: {
      type: String,
      sparse: true,
    },
    errorMessage: String,
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    lastAttemptAt: Date,
    sentAt: Date,
    deliveredAt: Date,
    readAt: Date,
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

// Compound indexes for common queries
recipientSchema.index({ campaignId: 1, status: 1 });
recipientSchema.index({ campaignId: 1, scheduledAt: 1 });
// For duplicate detection within a campaign
recipientSchema.index({ campaignId: 1, phoneNumber: 1 });

export const Recipient = mongoose.model<IRecipient>('Recipient', recipientSchema);
