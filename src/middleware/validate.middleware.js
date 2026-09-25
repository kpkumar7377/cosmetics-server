/**
 * Validates req.body, req.query, or req.params against a Zod schema.
 * Replaces req[target] with sanitized & stripped data.
 */
const validate =
  (schema, target = "body") =>
  (req, res, next) => {
    const result = schema.safeParse(req[target] || {});

    if (!result.success) {
      const rawIssues = result.error.issues || result.error.errors || [];
      const issues = rawIssues.map((err) => ({
        field: Array.isArray(err.path) ? err.path.join(".") : "",
        message: err.message,
      }));

      return res.status(400).json({
        success: false,
        message: issues[0]?.message || "Validation failed",
        errors: issues,
      });
    }

    // Assign sanitized & stripped values
    if (target === "body") {
      req.body = result.data;
    } else {
      // req.query and req.params are often getters in modern Express; assign keys safely
      req[target] = Object.assign(req[target] || {}, result.data);
    }

    next();
  };

module.exports = { validate };
