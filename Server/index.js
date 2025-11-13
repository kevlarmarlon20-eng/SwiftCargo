import express from "express";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Standard way to get __dirname in an ES Module
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const port = 8080;

// 🛑 THE KEY CHANGE: Use '..' to go up one folder.
// This resolves to C:\Users\Waterside\Desktop\SwiftCargo\client
const clientPath = join(__dirname, "..", "client");

// Setup static file serving
app.use(express.static(clientPath));

// OPTIONAL: Keep the specific route, using the same logic,
// but remember this isn't needed if express.static is serving the root.
app.get("/", (req, res) => {
    // This resolves to C:\Users\Waterside\Desktop\SwiftCargo\client\index.html
    res.sendFile(join(clientPath, "index.html")); 
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});