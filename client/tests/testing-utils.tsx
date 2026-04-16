import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { type PropsWithChildren, type ReactNode, Suspense } from "react";

const ThemeTestProvider = ({ children }: PropsWithChildren) => children;

const FleetTestProvider = ({ children }: PropsWithChildren) => children;

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  withSuspense?: boolean;
}

export const customRender = (
  ui: ReactNode,
  { withSuspense = false, ...options }: CustomRenderOptions = {},
): RenderResult => {
  const Wrapper = ({ children }: PropsWithChildren) => (
    <ThemeTestProvider>
      <FleetTestProvider>
        {withSuspense ? (
          <Suspense fallback={<div data-testid="suspense-fallback" />}>{children}</Suspense>
        ) : (
          children
        )}
      </FleetTestProvider>
    </ThemeTestProvider>
  );

  return render(ui, { wrapper: Wrapper, ...options });
};
