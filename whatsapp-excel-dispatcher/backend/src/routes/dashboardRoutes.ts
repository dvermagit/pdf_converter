import { Router, Request, Response } from 'express';
import { Campaign } from '../models/Campaign.js';
import { Recipient } from '../models/Recipient.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/dashboard/stats — Aggregate dashboard stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get today's start
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Overall campaign stats
    const [totalCampaigns, activeCampaigns, completedCampaigns] = await Promise.all([
      Campaign.countDocuments({ createdBy: userId }),
      Campaign.countDocuments({
        createdBy: userId,
        status: { $in: ['scheduled', 'in_progress', 'processing'] },
      }),
      Campaign.countDocuments({ createdBy: userId, status: 'completed' }),
    ]);

    // Message stats
    const userCampaignIds = await Campaign.find(
      { createdBy: userId },
      { _id: 1 }
    ).then((campaigns) => campaigns.map((c) => c._id));

    const [totalSent, totalDelivered, totalFailed, totalPending, sentToday] = await Promise.all([
      Recipient.countDocuments({
        campaignId: { $in: userCampaignIds },
        status: { $in: ['sent', 'delivered', 'read'] },
      }),
      Recipient.countDocuments({
        campaignId: { $in: userCampaignIds },
        status: { $in: ['delivered', 'read'] },
      }),
      Recipient.countDocuments({
        campaignId: { $in: userCampaignIds },
        status: 'failed',
      }),
      Recipient.countDocuments({
        campaignId: { $in: userCampaignIds },
        status: { $in: ['pending', 'queued', 'sending'] },
      }),
      Recipient.countDocuments({
        campaignId: { $in: userCampaignIds },
        sentAt: { $gte: today },
      }),
    ]);

    const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;

    // Recent campaigns
    const recentCampaigns = await Campaign.find({ createdBy: userId })
      .sort({ createdAt: -1 })
      .limit(5);

    // Upcoming deliveries (next 24 hours)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const upcomingDeliveries = await Recipient.find({
      campaignId: { $in: userCampaignIds },
      status: { $in: ['pending', 'queued'] },
      scheduledAt: { $gte: new Date(), $lte: tomorrow },
    })
      .sort({ scheduledAt: 1 })
      .limit(20)
      .populate('campaignId', 'name');

    res.json({
      stats: {
        totalCampaigns,
        activeCampaigns,
        completedCampaigns,
        totalSent,
        totalDelivered,
        totalFailed,
        totalPending,
        sentToday,
        deliveryRate,
      },
      recentCampaigns,
      upcomingDeliveries,
    });
  } catch (error) {
    logger.error({ error }, 'Dashboard stats failed');
    res.status(500).json({ error: 'Failed to load dashboard stats' });
  }
});

export default router;
