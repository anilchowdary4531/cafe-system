export async function verifyAuth(req, reply) {
    try {
        await req.jwtVerify();
    } catch (err) {
        const isExpired =
            err?.code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED" ||
            err?.code === "FAST_JWT_EXPIRED" ||
            err?.name === "TokenExpiredError" ||
            String(err?.message || "").toLowerCase().includes("expired");
        req.log?.warn?.(
            {
                reason: isExpired ? "TOKEN_EXPIRED" : "JWT_VERIFY_FAILED",
                code: err?.code,
                endpoint: req.url,
                method: req.method,
                pid: process.pid,
            },
            "auth_verify_rejected"
        );
        return reply.code(401).send({
            message: 'Unauthorized',
            code: isExpired ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED',
        });
    }
}