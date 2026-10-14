import { actor, body, fail, json } from "@/lib/works";
import { seedWorkCatalog, listCatalogWorks, saveCatalogWork, catalogOptions } from "@/lib/work-catalog";

export async function GET(request: Request) {
  try {
    await actor(request, "professor");
    await seedWorkCatalog();
    return json({ works: await listCatalogWorks(), ...catalogOptions });
  } catch (error) { return fail(error); }
}
async function save(request: Request, editing: boolean) {
  try {
    await actor(request, "professor");
    const data = await body(request);
    await seedWorkCatalog();
    return json({ item: await saveCatalogWork(data, editing) }, editing ? 200 : 201);
  } catch (error) { return fail(error); }
}
export async function POST(request: Request) { return save(request, false); }
export async function PATCH(request: Request) { return save(request, true); }
