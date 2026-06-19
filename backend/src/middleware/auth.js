export async function verifyAuth(req, reply) {
    try {
        await req.jwtVerify();
    } catch (err) {
        return reply.code(401).send({ message: 'Unauthorized' });
    }
}