import { getOverviewData } from "../services/overviewService.js";

export async function getOverview(req, res) {
  const data = await getOverviewData();
  return res.status(200).json(data);
}

