/// <reference types="@cloudflare/workers-types" />
/**
 * Cloudflare worker that puts out an og-image comparing OpenAPI and SLOP tokens
 *
 * Takes an {id} from the pathname and renders a comparison between:
 * - OpenAPI from https://openapisearch.com/redirect/{id}
 * - SLOP from https://oapis.org/slop/{id}
 */
import { ImageResponse } from "workers-og";

const htmlTemplate = `<div
    style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; background-color: #f5f7fa; margin: 0; display: flex; justify-content: center; align-items: center; width: 1200px; height: 630px;">
    <div
        style="background-color: white; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1); border-radius: 12px; overflow: hidden; width: 1000px; height: 530px; display: flex; flex-direction: column;">
        <div style="display: flex; flex: 1;">
            <div
                style="width: 50%; padding: 30px; display: flex; flex-direction: column; background-color: #fff9e7; border-right: 1px solid #f3f4f6;">
                <div
                    style="font-size: 36px; font-weight: 800; margin-bottom: 16px; color: #b45309; display: flex;">
                    OpenAPI: <span id="openapi-tokens" style="display: flex; margin-left: 10px;">--</span><span style="margin-left: 10px;"> tokens</span>
                </div>
                <div
                    style="background: rgba(0, 0, 0, 0.04); padding: 16px; border-radius: 8px; flex: 1; position: relative; display: flex; flex-direction: column;">
                    <div id="openapi-code"
                        style="font-family: 'Menlo', 'Monaco', 'Courier New', monospace; font-size: 16px; line-height: 1.6; margin: 0; max-height: 340px; overflow: hidden; word-wrap: break-word; word-break: break-all; display: flex; flex-direction: column;">{}</div>
                    <div
                        style="position: absolute; bottom: 0; right: 0; left: 0; padding: 6px 16px; background: rgba(0, 0, 0, 0.06); font-size: 14px; font-style: italic; text-align: right; color: #6b7280; display: flex; justify-content: flex-end;">
                        <span id="openapi-footer" style="display: flex;">loading...</span>
                    </div>
                </div>
            </div>
            <div
                style="width: 50%; padding: 30px; display: flex; flex-direction: column; background-color: #ecfdf5;">
                <div
                    style="font-size: 36px; font-weight: 800; margin-bottom: 16px; color: #047857; display: flex;">
                    SLOP: <span id="slop-tokens" style="display: flex; margin-left: 10px;">--</span> <span style="margin-left: 10px;"> tokens</span>
                </div>
                <div
                    style="background: rgba(0, 0, 0, 0.04); padding: 16px; border-radius: 8px; flex: 1; position: relative; display: flex; flex-direction: column;">
                    <div id="slop-code"
                        style="font-family: 'Menlo', 'Monaco', 'Courier New', monospace; font-size: 16px; line-height: 1.6; margin: 0; max-height: 340px; overflow: hidden; word-wrap: break-word; word-break: break-all; display: flex; flex-direction: column;"></div>
                    <div
                        style="position: absolute; bottom: 0; right: 0; left: 0; padding: 6px 16px; background: rgba(0, 0, 0, 0.06); font-size: 14px; font-style: italic; text-align: right; color: #6b7280; display: flex; justify-content: flex-end;">
                        <span id="slop-footer" style="display: flex;">loading...</span>
                    </div>
                </div>
            </div>

        </div>
        <div
            style="background: #4f46e5; padding: 20px; text-align: center; color: white; display: flex; justify-content: center; align-items:center;">

            <img src="https://openapisearch.com/logo/{{logoId}}" width="40" height="40" style="margin-right: 20px;" />

            <p
                style="font-weight: 700; font-size: 28px; margin: 0; word-wrap: break-word; display: flex;">
                Allow LLMs to Navigate the {{providerId}} API without Error
            </p>
        </div>
    </div>
</div>`;

/**
 * Calculates the estimated token count for a text
 * @param text The text to calculate tokens for
 * @returns Rounded token count estimate
 */
function calculateTokens(text: string): number {
  return Math.round(text.length / 5);
}

/**
 * Truncates text for display purposes
 * @param text Text to truncate
 * @param maxLength Maximum length to show
 * @returns Truncated text
 */
function truncateForDisplay(text: string, maxLength: number = 500): string {
  if (text.length <= maxLength) {
    // Format with line breaks for display
    return formatWithLineBreaks(text);
  }
  return formatWithLineBreaks(text.substring(0, maxLength)) + "...";
}

/**
 * Formats text with explicit line breaks for better display
 * @param text The input text to format
 * @returns Formatted text with line breaks
 */
function formatWithLineBreaks(text: string): string {
  // For OpenAPI (JSON format)
  if (text.trim().startsWith("{")) {
    try {
      // Try to parse as JSON and add line breaks
      const jsonObj = JSON.parse(text);
      let formattedText = JSON.stringify(jsonObj, null, 2);
      // Replace newlines with <br> for HTML display
      return formattedText
        .replace(/\n/g, "<br>")
        .replace(/\s\s/g, "&nbsp;&nbsp;");
    } catch (e) {
      // If parsing fails, just add breaks at reasonable intervals
      return addBreaksToText(text);
    }
  }
  // For SLOP format
  else {
    return addBreaksToText(text);
  }
}

/**
 * Adds breaks to text at reasonable intervals
 * @param text The text to process
 * @returns Text with breaks added
 */
function addBreaksToText(text: string): string {
  // Add breaks after common delimiter patterns
  let result = text
    .replace(/\n/g, "<br>")
    .replace(/\s-\s/g, "<br>- ")
    .replace(/\.\s+/g, ".<br>")
    .replace(/GET\s+/g, "GET<br>")
    .replace(/POST\s+/g, "POST<br>")
    .replace(/PUT\s+/g, "PUT<br>")
    .replace(/DELETE\s+/g, "DELETE<br>");

  return result;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const id = url.pathname.substring(1); // Remove leading slash to get {id}

    if (!id) {
      return new Response("API ID is required", { status: 400 });
    }

    try {
      // Fetch OpenAPI and SLOP in parallel
      const [openApiResponse, slopResponse] = await Promise.all([
        fetch(`https://openapisearch.com/redirect/${id}`),
        fetch(`https://oapis.org/slop/${id}`),
      ]);

      if (!openApiResponse.ok || !slopResponse.ok) {
        return new Response("Failed to fetch API specifications", {
          status: 404,
        });
      }

      // Get text from both responses
      const openApiText = await openApiResponse.text();
      const slopText = await slopResponse.text();

      // Calculate token counts
      const openApiTokens = calculateTokens(openApiText);
      const slopTokens = calculateTokens(slopText);

      // Prepare display text (truncated for visual purposes)
      const openApiDisplay = truncateForDisplay(openApiText);
      const slopDisplay = truncateForDisplay(slopText);

      // Create base HTML response
      const response = new Response(
        htmlTemplate
          .replace("{{providerId}}", id.length < 20 ? id : "")
          .replace("{{logoId}}", id),
        {
          headers: { "Content-Type": "text/html" },
        },
      );

      // Rewrite HTML with actual data
      const rewrite = new HTMLRewriter()
        .on("#openapi-tokens", {
          element(el) {
            el.setInnerContent(openApiTokens.toLocaleString());
          },
        })
        .on("#slop-tokens", {
          element(el) {
            el.setInnerContent(slopTokens.toLocaleString());
          },
        })
        .on("#openapi-code", {
          element(el) {
            // Set HTML content to preserve line breaks
            el.setInnerContent(openApiDisplay, { html: true });
          },
        })
        .on("#slop-code", {
          element(el) {
            // Set HTML content to preserve line breaks
            el.setInnerContent(slopDisplay, { html: true });
          },
        })
        .on("#openapi-footer", {
          element(el) {
            el.setInnerContent(
              `${openApiTokens.toLocaleString()} tokens total`,
            );
          },
        })
        .on("#slop-footer", {
          element(el) {
            el.setInnerContent(`${slopTokens.toLocaleString()} tokens only`);
          },
        })
        .transform(response);

      const html = await rewrite.text();

      // Generate the image response
      return new ImageResponse(html, {
        width: 1200,
        height: 630,
        format: "png",
      });
    } catch (error) {
      console.error("Error generating OG image:", error);
      return new Response("Error generating image", { status: 500 });
    }
  },
};
