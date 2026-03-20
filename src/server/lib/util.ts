export async function TestOAIAPI(url: string, apiKey: string) {
    const res = await fetch(`${url}/openai/v1/models`, {
        headers: { Authorization: `Bearer ${apiKey}` }
    })

    let errorMessage = null

    if (!res.ok) {
        const error = await res.json()
        errorMessage = error.error?.message ?? `HTTP ${res.status}`
    }

    return {
        status: res.status,
        error: errorMessage
    }
}

export function IsDuplicateEntry(err: unknown, key?: string): boolean {
    return (
        err instanceof Error &&
        "code" in err &&
        err.code === "ER_DUP_ENTRY" &&
        (key ? err.message.includes(key) : true)
    )
}
