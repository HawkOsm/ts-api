import express, { NextFunction, Request, Response } from "express";
import multer from "multer";
import swaggerUi from "swagger-ui-express";
import openapi from "./docs/openapi.json";
import { ContactService } from "./services/contactService";
import { ContactDto, ContactPatchDto, DtoError, parseId, parseKeyword, parseSortBy, parseTagBody, parseTagName, parseTagSearch } from "./dto/contactDto";

const app = express();
app.disable("x-powered-by");   // do not tell every client which framework runs here

// CORS: lets a web app served from another address (for example a contact-list UI) call this API.
// There are no logins or cookies, so allowing every origin is safe. A browser first sends an OPTIONS
// "preflight" request before POST/PUT/PATCH/DELETE with JSON, and it must be answered here.
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Expose-Headers", "Location");   // so the UI can read the Location of a new contact
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

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

// Swagger: the page is at /api-docs and the raw spec at /openapi.json.
// servers is forced to "/" so "Try it out" calls the same host, locally and on Azure.
const swaggerDocument = { ...openapi, servers: [{ url: "/" }] };
app.get("/openapi.json", (req: Request, res: Response) => {
  res.json(swaggerDocument);
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

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
  const dto = ContactDto.fromRequest(req.body);
  const contact = contactDb.create(dto.toContact());
  res.status(201).location(`/contacts/${contact.id}`).json(contact);
});

app.get("/contacts", (req: Request, res: Response) => {
  res.json(contactDb.list());
});

// GET /contacts/search?keyword=... (like the teacher's /todos/search).
// It must be registered BEFORE "/contacts/:id": otherwise "search" would be read as an id and give a 400.
app.get("/contacts/search", (req: Request, res: Response) => {
  res.json(contactDb.search(parseKeyword(req.query.keyword)));
});

// GET /contacts/sort?by=name|name_desc|tags: every contact in the chosen order.
// Also registered BEFORE "/contacts/:id", for the same reason as "/contacts/search".
app.get("/contacts/sort", (req: Request, res: Response) => {
  res.json(contactDb.listSorted(parseSortBy(req.query.by)));
});

app.get("/contacts/:id", (req: Request, res: Response) => {
  const contact = contactDb.get(parseId(req.params.id));
  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  res.json(contact);
});

app.put("/contacts/:id", (req: Request, res: Response) => {
  const id = parseId(req.params.id);                          
  const dto = ContactDto.fromRequest(req.body);                   
  const contact = contactDb.replace(id, dto.toContact());        
  if (!contact) throw new DtoError("Contact not found", 404);
  res.json(contact);
});

// PATCH = change some fields only, e.g. {"isStarred": true}
app.patch("/contacts/:id", (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const dto = ContactPatchDto.fromRequest(req.body);
  const contact = contactDb.update(id, dto.toPatch());
  if (!contact) throw new DtoError("Contact not found", 404);
  res.json(contact);
});

app.delete("/contacts/:id", (req: Request, res: Response) => {
  if (!contactDb.delete(parseId(req.params.id))) throw new DtoError("Contact not found", 404);
  res.status(204).end();
});

// Picture upload, download and deletion
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

// The list of known tags (add and delete, no rename)
app.get("/tags", (req: Request, res: Response) => {
  res.json(contactDb.getTags(parseTagSearch(req.query.search)));
});

app.post("/tags", (req: Request, res: Response) => {
  const tag = contactDb.addTag(parseTagBody(req.body));   // 400 for a bad name, 409 if it already exists
  res.status(201).location(`/tags/${encodeURIComponent(tag.name)}`).json(tag);
});

app.delete("/tags/:name", (req: Request, res: Response) => {
  if (!contactDb.removeTag(parseTagName(req.params.name))) throw new DtoError("Tag not found", 404);
  res.status(204).end();
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// 2) every error thrown by a route or by multer ends up here
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof DtoError) { res.status(err.statusCode).json({ error: err.message }); return; }
  if (err instanceof multer.MulterError) {
    res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: err.message });
    return;
  }
  // Express and its body parser attach the right 4xx status to the errors caused by the client
  // (a broken URL like /contacts/%E0%A4%A, bad JSON, a body over 100 KB): pass that status on instead of a 500.
  const status = err?.status ?? err?.statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    const error = err.type === "entity.parse.failed" ? "request body is not valid JSON"
      : err.type === "entity.too.large" ? "request body is too large"
      : String(err.message ?? "bad request");
    res.status(status).json({ error });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "internal server error" });
});

