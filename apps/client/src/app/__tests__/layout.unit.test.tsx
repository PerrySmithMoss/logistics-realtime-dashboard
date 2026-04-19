import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

import RootLayout, { metadata } from "../layout";

describe("RootLayout", () => {
  it("exports the expected metadata", () => {
    expect(metadata).toEqual({
      title: "Fleet Dashboard",
      description: "Real-time logistics fleet monitoring",
    });
  });

  it("wraps children in the expected html and body shell", () => {
    const tree = RootLayout({
      children: <div>Dashboard</div>,
    });

    expect(tree.type).toBe("html");
    expect(tree.props.lang).toBe("en");
    expect(tree.props.className).toContain("--font-geist-sans");
    expect(tree.props.className).toContain("--font-geist-mono");
    expect(tree.props.children.type).toBe("body");
    expect(tree.props.children.props.className).toContain("min-h-full");
    expect(tree.props.children.props.children.props.children).toBe("Dashboard");
  });
});
