import dotenv from "dotenv"

dotenv.config()

export const DJANGO_API = process.env.DJANGO_API
export const PORT = process.env.PORT || 5000