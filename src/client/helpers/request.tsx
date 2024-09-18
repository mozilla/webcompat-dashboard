export const jsonPostMutation = async (uuid: string, endpoint: string, additionalBodyFields?: any) => {
  const payload = Object.assign(
    {},
    {
      report_uuid: uuid,
    },
    additionalBodyFields,
  );

  const res = await fetch(`${import.meta.env.VITE_BACKEND_WEB_ROOT}${endpoint}`, {
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (res.status == 201) {
    return await res.json();
  } else {
    const body = await res.text();
    throw new Error(`Unexpected status code: ${res.status}, body: "${body}"`);
  }
};
