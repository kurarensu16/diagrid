import { type Diagram } from '../services/mockDb';

export interface SharePayload {
  id: string;
  title: string;
  type: Diagram['type'];
  content: string;
}

/**
 * Strips unnecessary properties from nodes/edges to minimize payload size for URL sharing.
 * Keeps only rendering-critical fields.
 */
const slimifyContent = (contentStr: string): string => {
  try {
    const parsed = JSON.parse(contentStr);
    const nodes = (parsed.nodes || []).map((n: any) => {
      const slim: any = {
        id: n.id,
        x: n.x,
        y: n.y,
        label: n.label,
        type: n.type,
      };
      // Only include non-default optional properties
      if (n.fields && n.fields.length > 0) slim.fields = n.fields;
      if (n.customWidth) slim.customWidth = n.customWidth;
      if (n.customHeight) slim.customHeight = n.customHeight;
      if (n.fillColor && n.fillColor !== 'transparent') slim.fillColor = n.fillColor;
      if (n.shadowAccent && n.shadowAccent !== 'none') slim.shadowAccent = n.shadowAccent;
      if (n.borderStyle && n.borderStyle !== 'solid') slim.borderStyle = n.borderStyle;
      if (n.borderWidth && n.borderWidth !== 2) slim.borderWidth = n.borderWidth;
      if (n.fontSize && n.fontSize !== 'md') slim.fontSize = n.fontSize;
      if (n.customFontSize) slim.customFontSize = n.customFontSize;
      if (n.textAlign && n.textAlign !== 'center') slim.textAlign = n.textAlign;
      if (n.isBold === false) slim.isBold = false;
      return slim;
    });

    const edges = (parsed.edges || []).map((e: any) => {
      const slim: any = {
        id: e.id,
        source: e.source,
        target: e.target,
      };
      if (e.sourceHandle) slim.sourceHandle = e.sourceHandle;
      if (e.targetHandle) slim.targetHandle = e.targetHandle;
      if (e.label) slim.label = e.label;
      if (e.style && e.style !== 'solid') slim.style = e.style;
      if (e.arrow && e.arrow !== 'end') slim.arrow = e.arrow;
      if (e.sourceMarker) slim.sourceMarker = e.sourceMarker;
      if (e.targetMarker) slim.targetMarker = e.targetMarker;
      return slim;
    });

    const drawings = parsed.drawings || [];

    return JSON.stringify({ nodes, edges, drawings });
  } catch {
    return contentStr;
  }
};

/**
 * Encodes diagram metadata and schematic content into a compact, URL-safe base64 string
 * for universal, cross-browser link sharing with zero database dependencies.
 * 
 * Uses payload slimming to reduce URL size.
 */
export const encodeSharePayload = (payload: SharePayload): string => {
  try {
    // Slim down the content to reduce URL size
    const slimContent = slimifyContent(payload.content);
    const slimPayload = { ...payload, content: slimContent };

    const jsonStr = JSON.stringify(slimPayload);
    // Safe UTF-8 to Base64 encoding
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const encoded = btoa(binary);

    // Warn if payload is very large (may cause issues in some browsers/proxies)
    if (encoded.length > 8000) {
      console.warn(`[shareUtils] Large share payload: ${encoded.length} chars (original: ${payload.content.length}, slimmed: ${slimContent.length})`);
    }

    return encoded;
  } catch (err) {
    console.error('[shareUtils] Failed to encode share payload:', err);
    return '';
  }
};

/**
 * Decodes a URL-safe base64 string back into diagram schema state.
 */
export const decodeSharePayload = (encoded: string): SharePayload | null => {
  try {
    const cleanEncoded = encoded.replace(/^#d=/, '').trim();
    if (!cleanEncoded) return null;

    const binary = atob(cleanEncoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decodedJson = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(decodedJson);

    if (!parsed || !parsed.title || !parsed.type) {
      console.warn('[shareUtils] Decoded payload missing required fields:', { hasTitle: !!parsed?.title, hasType: !!parsed?.type });
      return null;
    }

    console.log('[shareUtils] Successfully decoded payload:', { title: parsed.title, type: parsed.type, contentLength: parsed.content?.length });
    return parsed as SharePayload;
  } catch (err) {
    console.warn('[shareUtils] Failed to decode share payload from hash:', err);
    return null;
  }
};
