import express, { Request, Response } from "express";

const app = express();
app.get("/", (req: Request, res: Response) => {
  res.send("Hello World!");
});

function getServerPort(): number {
    const port = process.env.PORT || 3000;
    return parseInt(port.toString(), 10);
    }
const serverPort = getServerPort();

app.listen(serverPort, () => {
  console.log(`Server is running on port http://localhost:${serverPort}`);
});