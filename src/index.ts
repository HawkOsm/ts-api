import express, { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ContactService } from "./services/contactService";
import { DtoError, parseId } from "./dto/contactDto";

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

app.use(express.json());
const contactDb = new ContactService();
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 },   // 1 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new DtoError("Only png, jpeg or webp images are allowed", 415));
  },
});

// the first bytes of a real image file ("magic bytes")
function looksLikeImage(bytes: Uint8Array, type: string): boolean {
  const startsWith = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (type === "image/jpeg") return startsWith([0xff, 0xd8, 0xff]);
  if (type === "image/png") return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (type === "image/webp") return startsWith([0x52, 0x49, 0x46, 0x46]) && Buffer.from(bytes.slice(8, 12)).toString("ascii") === "WEBP";
  return false;
}

app.post("/contacts", (req: Request, res: Response) => {
  const contact = contactDb.create(req.body);
  if (!contact) {
    res.status(400).json({ error: "Failed to create contact" });
    return;
  }
  res.status(201).json({ id: contact.id });
});

app.put("/contacts/:id/picture", upload.single("file"), (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!req.file) throw new DtoError("Send the image in a form field named 'file'", 400);
  if (!looksLikeImage(req.file.buffer, req.file.mimetype)) throw new DtoError("File content does not match its image type", 415);
  if (!contactDb.setPicture(id, req.file.buffer, req.file.mimetype)) throw new DtoError("Contact not found", 404);
  res.status(204).end();
});

app.get("/contacts/:id/picture", (req: Request, res: Response) => {
  const picture = contactDb.getPicture(parseId(req.params.id));
  if (!picture) throw new DtoError("No picture", 404);
  res.type(picture.type).send(Buffer.from(picture.bytes));
});

app.delete("/contacts/:id/picture", (req: Request, res: Response) => {
  if (!contactDb.removePicture(parseId(req.params.id))) throw new DtoError("No picture", 404);
  res.status(204).end();
});

app.get("/contacts/:id", (req: Request, res: Response) => {
  const contact = contactDb.get(parseId(req.params.id));   // throws a 400 error for a bad id
  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  res.json(contact);
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof DtoError) { res.status(err.statusCode).json({ error: err.message }); return; }
  if (err instanceof multer.MulterError) {
    res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "internal server error" });
});