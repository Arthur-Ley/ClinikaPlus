import { Router } from "express";
import { getBuckets, getSignedUploadUrl } from "../controllers/storageController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const storageRouter = Router();

storageRouter.get("/buckets", asyncHandler(getBuckets));
storageRouter.post("/signed-upload-url", asyncHandler(getSignedUploadUrl));
