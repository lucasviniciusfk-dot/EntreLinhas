const {
  BlobSASPermissions,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} = require("@azure/storage-blob");

function safeName(name) {
  return String(name || "arquivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

exports.handler = async function (event) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

  const headers = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        ok: false,
        error: "Método não permitido.",
      }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const tipo = body.tipo;
    const fileName = safeName(body.fileName || "arquivo.bin");
    const contentType = body.contentType || "application/octet-stream";
    const userId = safeName(body.userId || "anonimo");
    const albumId = safeName(body.albumId || "geral");

    const folders = {
      epub: "epubs",
      capa: "capas",
      avatar: "avatares",
      "foto-encontro": "fotos-encontros",
    };

    const folder = folders[tipo];

    if (!folder) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          ok: false,
          error: "Tipo de arquivo inválido.",
        }),
      };
    }

    const account = process.env.AZURE_STORAGE_ACCOUNT;
    const container = process.env.AZURE_STORAGE_CONTAINER || "entrelinhas";
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
    const publicBaseUrl = process.env.AZURE_PUBLIC_BASE_URL;

    if (!account || !container || !accountKey || !publicBaseUrl) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          ok: false,
          error: "Azure não configurado no Netlify.",
        }),
      };
    }

    const ext = fileName.includes(".") ? fileName.split(".").pop() : "bin";
    const stamp = Date.now();

    let blobName;

    if (tipo === "avatar") {
      blobName = `${folder}/${userId}/avatar-${stamp}.${ext}`;
    } else if (tipo === "foto-encontro") {
      blobName = `${folder}/${albumId}/${stamp}-${fileName}`;
    } else {
      blobName = `${folder}/${userId}/${stamp}-${fileName}`;
    }

    const credential = new StorageSharedKeyCredential(account, accountKey);

    const expiresOn = new Date(Date.now() + 10 * 60 * 1000);

    const sas = generateBlobSASQueryParameters(
      {
        containerName: container,
        blobName,
        permissions: BlobSASPermissions.parse("cw"),
        startsOn: new Date(Date.now() - 60 * 1000),
        expiresOn,
        contentType,
      },
      credential
    ).toString();

    const uploadUrl = `https://${account}.blob.core.windows.net/${container}/${blobName}?${sas}`;
    const publicUrl = `${publicBaseUrl.replace(/\/$/, "")}/${blobName}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        uploadUrl,
        publicUrl,
        blobName,
        expiresAt: expiresOn.toISOString(),
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ok: false,
        error: error.message || "Erro ao gerar SAS.",
      }),
    };
  }
};
