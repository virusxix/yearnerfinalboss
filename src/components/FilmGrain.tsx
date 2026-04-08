"use client";

type Props = {
  staticOnly?: boolean;
};

export function FilmGrain({ staticOnly = false }: Props) {
  return <div className={staticOnly ? "eh-grain-static" : "eh-grain"} aria-hidden />;
}
