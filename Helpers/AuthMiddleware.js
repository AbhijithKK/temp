import jwt from "jsonwebtoken";

const authMiddleware = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(403).json({ message: "Access denied.", error: true });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const user = decoded.user;
// console.log(user,'user');

        if (!user) {
            console.log("Middleware throwing invalid error");
            return res.status(403).json({ error: true, message: "Invalid token" });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(400).json({ error: true, message: "Invalid request" });
    }
};

export default authMiddleware;
