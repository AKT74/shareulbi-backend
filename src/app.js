const express = require("express")
const cors = require("cors")
const cookieParser = require("cookie-parser") // ⬅️ TAMBAH
require("dotenv").config()

console.log("ENV CHECK:", {
  DATABASE_URL: !!process.env.DATABASE_URL,
  SUPABASE_URL: !!process.env.SUPABASE_URL,
  SUPABASE_SECRET_KEY: !!process.env.SUPABASE_SECRET_KEY,
  JWT_SECRET: !!process.env.JWT_SECRET,
})

const app = express()

const authRoutes = require("./routes/auth.routes")
const postsRoutes = require("./routes/posts.routes")
const categoriesRoutes = require("./routes/categories.routes")
const adminRoutes = require("./routes/admin.routes")
const departmentsRoutes = require("./routes/departments.routes")
const validationRoutes = require("./routes/validation.routes")
const usersRoutes = require("./routes/users.routes")
const interactionsRoutes = require("./routes/interactions.routes")
const bookmarksRoutes = require("./routes/bookmarks.routes")
const feedbackTopicRoutes = require("./routes/feedbackTopic.routes")
const reportsFeedbackRoutes = require("./routes/reportsFeedback.routes")
const elearningRoutes = require("./routes/elearning.routes")
const worksRoutes = require("./routes/works.routes")

// ================= MIDDLEWARES =================
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://shareulbi-frontend.vercel.app"
  ],
     
  credentials: true
}));



app.use(express.json())
app.use(cookieParser()) // ⬅️ WAJIB

// ================= ROUTES =================
app.use("/api", authRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/posts", postsRoutes)
app.use("/api/categories", categoriesRoutes)
app.use("/api/departments", departmentsRoutes)
app.use("/api/validation", validationRoutes)
app.use("/api/users", usersRoutes)
app.use("/api", interactionsRoutes)
app.use("/api", bookmarksRoutes)
app.use("/api/feedback-topics", feedbackTopicRoutes)
app.use("/api/reports-feedbacks", reportsFeedbackRoutes)
app.use("/api/e-learning", elearningRoutes)
app.use("/api/works", worksRoutes)

// ================= START SERVER =================
const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
})
