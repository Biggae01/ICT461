const express = require("express");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.all("/inspect", (req, res) => {
    res.json({
        method: req.method,
        path: req.path,
        headers: req.headers,
        body: req.body
    });
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});