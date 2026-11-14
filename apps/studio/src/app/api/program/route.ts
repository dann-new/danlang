import { classifierFields } from "@/lib/providers";
import { defaultFolder, listFolders, loadFolder } from "@/lib/program";

export async function GET(request: Request) {
  const folder = new URL(request.url).searchParams.get("folder") || defaultFolder();
  const loaded = loadFolder(folder);
  return Response.json({
    ...loaded,
    folders: listFolders(),
    classifierFields: loaded.program ? classifierFields(loaded.program) : [],
    keys: { classifier: Boolean(process.env.JEV_API_KEY), model: Boolean(process.env.OPENROUTER_API_KEY) },
  });
}
