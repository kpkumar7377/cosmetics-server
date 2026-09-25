const { z } = require("zod");

const dashboardSummaryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(5),
});

module.exports = {
  dashboardSummaryQuerySchema,
};
