import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const {
      contractAddress,
      contractName,
      functionName,
      functionArgs,
      sender,
    } = await request.json();

    const url = `https://api.testnet.hiro.so/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: sender,
        arguments: functionArgs || [],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Stacks API error:", error);
      return NextResponse.json(
        { error: "API request failed" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { error: "Proxy failed", details: String(error) },
      { status: 500 }
    );
  }
}

export const runtime = "edge";
