## Project Overview

Ohmline is a web-based circuit designer that allows users to design electronic circuits and compute their properties. Users can create circuits by adding nodes and edges (resistances), calculate equivalent resistances, and analyze electric currents based on node potentials.

## Interface looks

The "UI" menu in the top bar switches between six looks. The choice is
kept in `localStorage` and in the URL (`#ui=terminal`), so a link opens
the same look. Every look uses the same markup; each is one stylesheet in
`public/ui/`.

| Look      | Type                                  | Inspired by |
| --------- | ------------------------------------- | ----------- |
| Classic   | Inter                                 | the original Ohmline UI, tldraw/Excalidraw floating panels |
| Journal   | Playfair Display, Source Serif 4      | The Public Domain Review, newspaper mastheads, the Feynman Lectures index |
| Terminal  | JetBrains Mono                        | Falstad's circuit simulator, Advent of Code, vim's status line |
| Swiss     | Archivo                               | U.S. Graphics Company, Grilli Type, International Typographic Style |
| Library   | Cormorant Garamond, EB Garamond       | Stripe Press, book frontispieces, tables of contents with leaders |
| Blueprint | Barlow Condensed, IBM Plex Mono       | cyanotype engineering drawings, teenage engineering, Falstad |

Terminal and Blueprint animate current along live wires (respecting
reduced-motion).
