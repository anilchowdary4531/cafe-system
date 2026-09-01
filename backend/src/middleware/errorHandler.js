import logger from "../utils/logger.js";

export function globalErrorHandler(error, request, reply) {
    const statusCode = error.statusCode || error.status || 500;
    const message = error.message || "Internal Server Error";

    logger.error(`API Error [${request.method} ${request.url}]`, {
        statusCode,
        message,
        stack: error.stack,
    });

    if (error.validation) {
        return reply.status(400).send({
            error: "Validation Failed",
            message: "Invalid payload parameters.",
            details: error.validation,
            statusCode: 400,
        });
    }

    return reply.status(statusCode).send({
        error: statusCode >= 500 ? "Internal Server Error" : "Bad Request",
        message: statusCode >= 500 ? "An unexpected error occurred." : message,
        statusCode,
    });
}

export default globalErrorHandler;
