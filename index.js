const express = require("express");
const UserRoute = require("./routes/UserRoute");
const cookieParser = require("cookie-parser")
const app = express();

require("dotenv").config();

app.use(cookieParser());
app.use(express.json());

const PORT = process.env.PORT || 4000;

app.use("/api/v1", UserRoute);

app.listen(PORT, () => {
    console.log(`Server is running on port no. ${PORT}`);
})

require("./config/connectDB").connectDB();
