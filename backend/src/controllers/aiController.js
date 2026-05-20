import { getCustomerInsights, getRecommendations } from "../services/aiService.js";

export const buildAiController = ({ prisma }) => {
  const getRecommendationsRoute = async (req, reply) => {
    try {
      const actor = req.staffActor;
      const restaurantId = Number(req.query?.restaurantId || actor?.restaurantId || 0);
      const limit = Number(req.query?.limit || 8);
      const data = await getRecommendations({ prisma, restaurantId, limit });
      return data;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch recommendations" });
    }
  };

  const getCustomerInsightsRoute = async (req, reply) => {
    try {
      const actor = req.staffActor;
      const restaurantId = Number(req.query?.restaurantId || actor?.restaurantId || 0);
      const data = await getCustomerInsights({ prisma, restaurantId });
      return data;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch customer insights" });
    }
  };

  return { getRecommendationsRoute, getCustomerInsightsRoute };
};

