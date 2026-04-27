import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getNotifications,
  getNotificationsSummary,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  resolveNotificationItem,
} from "../controllers/notificationController.js";

export const notificationRouter = Router();

notificationRouter.get("/", asyncHandler(getNotifications));
notificationRouter.get("/summary", asyncHandler(getNotificationsSummary));
notificationRouter.post("/read-all", asyncHandler(markAllNotificationsAsRead));
notificationRouter.post("/:notificationId/read", asyncHandler(markNotificationAsRead));
notificationRouter.post("/:notificationId/resolve", asyncHandler(resolveNotificationItem));
