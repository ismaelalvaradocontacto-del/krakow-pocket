const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store, max-age=0',
  'x-content-type-options': 'nosniff'
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function compact(value) {
  return String(value ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
}

function uppercase(value) {
  return compact(value).toLocaleUpperCase('es-ES');
}

function cleanVehicle(raw = {}) {
  const confidence = raw.confidence || {};
  const threshold = 0.64;
  const accept = (name, value) => Number(confidence[name] ?? 0) >= threshold ? value : null;

  let brand = accept('brand', raw.brand);
  let model = accept('model', raw.model);
  let vin = accept('vin', raw.vin);
  let plate = accept('plate', raw.plate);

  brand = brand ? uppercase(brand).replace(/[^A-ZÁÉÍÓÚÜÑ0-9 .&+\-/]/g, ' ').replace(/\s+/g, ' ').trim() : null;
  model = model ? uppercase(model).replace(/[^A-ZÁÉÍÓÚÜÑ0-9 .+\-_/]/g, ' ').replace(/\s+/g, ' ').trim() : null;
  vin = vin ? uppercase(vin).replace(/[^A-Z0-9]/g, '') : null;
  plate = plate ? uppercase(plate).replace(/[^A-Z0-9]/g, '') : null;

  if (brand && (brand.length < 2 || brand.length > 48)) brand = null;
  if (model && (model.length < 1 || model.length > 70)) model = null;
  if (vin && (vin.length < 5 || vin.length > 30 || !/[A-Z]/.test(vin) || !/\d/.test(vin) || /OBSERV|DOCUMENT|KILOMET|FECHA|VIGOR|ESPECIFICAR/.test(vin))) vin = null;
  if (plate && (plate.length < 4 || plate.length > 12 || !/[A-Z]/.test(plate) || !/\d/.test(plate))) plate = null;

  return { brand, model, vin, plate };
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

function responseOutputText(data) {
  if (typeof data?.output_text === 'string' && data.output_text) return data.output_text;
  for (const item of data?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === 'output_text' && typeof part.text === 'string') return part.text;
    }
  }
  return '';
}

async function uploadPdf(file, apiKey) {
  const body = new FormData();
  body.append('purpose', 'user_data');
  body.append('file', file, file.name || 'permiso-circulacion.pdf');
  const response = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}` },
    body
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id) throw new Error(data?.error?.message || 'No se pudo preparar el PDF.');
  return data.id;
}

async function deleteOpenAiFile(fileId, apiKey) {
  if (!fileId) return;
  try {
    await fetch(`https://api.openai.com/v1/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${apiKey}` }
    });
  } catch (_) {}
}

async function readVehicle(request, env) {
  if (!env.OPENAI_API_KEY) {
    return json({ ok: false, code: 'NOT_CONFIGURED', message: 'La lectura automática todavía no tiene configurada la clave del servicio.' }, 503);
  }

  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return json({ ok: false, code: 'FORBIDDEN' }, 403);

  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite && !['same-origin', 'same-site', 'none'].includes(secFetchSite)) {
    return json({ ok: false, code: 'FORBIDDEN' }, 403);
  }

  let form;
  try { form = await request.formData(); }
  catch (_) { return json({ ok: false, code: 'BAD_FORM' }, 400); }

  const file = form.get('file');
  if (!(file instanceof File) || !file.size) return json({ ok: false, code: 'NO_FILE' }, 400);
  if (file.size > 20 * 1024 * 1024) return json({ ok: false, code: 'FILE_TOO_LARGE', message: 'El archivo supera 20 MB.' }, 413);

  const type = (file.type || '').toLowerCase();
  const isPdf = type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  const isImage = type.startsWith('image/');
  if (!isPdf && !isImage) return json({ ok: false, code: 'UNSUPPORTED_FILE' }, 415);

  const prompt = `Lee este permiso de circulación español y extrae SOLO la identificación del vehículo.\n\nCampos oficiales prioritarios:\n- A = matrícula\n- D.1 = marca\n- D.3 = denominación comercial / modelo\n- E = número de bastidor\n\nLa entrada puede ser una foto, captura de pantalla o PDF; puede estar inclinada, recortada, comprimida, con sombras, líneas de tabla o varias páginas. Usa la estructura visual del documento, no la posición fija de los píxeles. Ignora nombre del titular, observaciones, fechas, ITV, motor y hojas adicionales salvo que ayuden a confirmar el mismo dato.\n\nReglas:\n- No inventes ni completes caracteres por conocimiento del vehículo.\n- Conserva exactamente letras y números que puedas leer; devuelve todo en mayúsculas.\n- Si un campo no se puede leer con suficiente seguridad, devuelve null.\n- Una matrícula antigua española puede ser como GC4698CJ; una moderna como 3068FPL.\n- El bastidor suele tener 17 caracteres, pero vehículos antiguos pueden variar; solo usa el valor asociado al campo E.\n- La confianza debe reflejar la lectura visual real del campo, no una inferencia.`;

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      brand: { type: ['string', 'null'] },
      model: { type: ['string', 'null'] },
      vin: { type: ['string', 'null'] },
      plate: { type: ['string', 'null'] },
      confidence: {
        type: 'object',
        additionalProperties: false,
        properties: {
          brand: { type: 'number', minimum: 0, maximum: 1 },
          model: { type: 'number', minimum: 0, maximum: 1 },
          vin: { type: 'number', minimum: 0, maximum: 1 },
          plate: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['brand', 'model', 'vin', 'plate']
      }
    },
    required: ['brand', 'model', 'vin', 'plate', 'confidence']
  };

  let temporaryFileId = null;
  try {
    const content = [{ type: 'input_text', text: prompt }];
    if (isPdf) {
      temporaryFileId = await uploadPdf(file, env.OPENAI_API_KEY);
      content.push({ type: 'input_file', file_id: temporaryFileId });
    } else {
      const base64 = arrayBufferToBase64(await file.arrayBuffer());
      content.push({ type: 'input_image', image_url: `data:${type || 'image/jpeg'};base64,${base64}`, detail: 'high' });
    }

    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: env.TRASPASO_VISION_MODEL || 'gpt-5.4-mini',
        store: false,
        max_output_tokens: 400,
        input: [{ role: 'user', content }],
        text: {
          format: {
            type: 'json_schema',
            name: 'vehicle_identity',
            strict: true,
            schema
          }
        }
      })
    });

    const responseData = await openAiResponse.json().catch(() => ({}));
    if (!openAiResponse.ok) {
      console.error('OpenAI vehicle read error', responseData?.error?.code || openAiResponse.status);
      return json({ ok: false, code: 'AI_ERROR', message: 'No se ha podido analizar el documento.' }, 502);
    }

    let parsed;
    try { parsed = JSON.parse(responseOutputText(responseData)); }
    catch (_) { return json({ ok: false, code: 'BAD_AI_RESPONSE', message: 'La lectura no ha devuelto un resultado válido.' }, 502); }

    const vehicle = cleanVehicle(parsed);
    const filled = Object.values(vehicle).filter(Boolean).length;
    return json({ ok: true, vehicle, filled });
  } finally {
    await deleteOpenAiFile(temporaryFileId, env.OPENAI_API_KEY);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/vehicle-read') {
      if (request.method !== 'POST') return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
      try { return await readVehicle(request, env); }
      catch (error) {
        console.error('Vehicle reader failure', error?.message || error);
        return json({ ok: false, code: 'SERVER_ERROR', message: 'No se ha podido analizar el documento.' }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  }
};