import mongoose, { Schema, Document, Types } from 'mongoose';

export type MetaTemplateStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';
export type MetaHeaderType = 'none' | 'document' | 'text' | 'image';

/**
 * Link to the approved template registered with Meta. Business-initiated
 * messages — which is all of ours — can only be sent through one of these.
 * `bodyParameters` names which of our placeholders feeds Meta's positional
 * {{1}}, {{2}}, … in order.
 */
export interface IMetaTemplate {
  templateName: string;
  languageCode: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  status: MetaTemplateStatus;
  headerType: MetaHeaderType;
  bodyParameters: string[];
}

export interface ITemplate extends Document {
  name: string;
  occasion: string;
  description: string;
  messageBody: string;
  meta?: IMetaTemplate;
  eventDate?: Date;
  defaultSendTime: string; // "HH:mm" in the template timezone
  timezone: string;
  emoji: string;
  usageCount: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const templateSchema = new Schema<ITemplate>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    occasion: {
      type: String,
      default: 'custom',
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    messageBody: {
      type: String,
      required: true,
    },
    meta: {
      type: new Schema<IMetaTemplate>(
        {
          templateName: { type: String, required: true, trim: true },
          languageCode: { type: String, default: 'en' },
          category: {
            type: String,
            enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'],
            default: 'MARKETING',
          },
          status: {
            type: String,
            enum: ['not_submitted', 'pending', 'approved', 'rejected'],
            default: 'not_submitted',
          },
          headerType: {
            type: String,
            enum: ['none', 'document', 'text', 'image'],
            default: 'none',
          },
          bodyParameters: { type: [String], default: [] },
        },
        { _id: false }
      ),
      default: undefined,
    },
    eventDate: {
      type: Date,
    },
    defaultSendTime: {
      type: String,
      default: '10:00',
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    emoji: {
      type: String,
      default: '🎉',
    },
    usageCount: {
      type: Number,
      default: 0,
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

// Listing templates by user, newest first
templateSchema.index({ createdBy: 1, createdAt: -1 });

export const Template = mongoose.model<ITemplate>('Template', templateSchema);
