# Ohmline
Ohmline is a web app that allows users to design electronic circuits and compute their properties.

## Features and Use cases
- The user can add nodes and edges to the canvas. Multiple edges can be added to a single node. It is possible to add multiple edges to the same pair of nodes (edges in parallel). Each edge is a resistance.
- The user can set the value of each resistance. The value can either be in ohms or it can also be a variable e.g. r.
- The system is able to compute the equivalent resistance between two connected nodes in the circuit. Variables are to be taken as variables, that is, two resistances of r each in series give a 2r equivalent resistance; an r resistance with a 10 ohm resistance give equivalent resistance of r + 10 ohms.
- The user can add nodes anywhere on the canvas, however, there is a button that prompts the system to redistributes the nodes in order to optimize visualization, without change the properties of the circuit.
- The value of the resistance is visible in their respective edge.
- Resistance values real numbers, that is, zero and negative resistance is possible.
- It is possible to represent infinite resistance.
- The user can set electric potentials in each node in order to ask for the electric current in the system.
- Circuit properties are computed based on the laws of physics applied to electric circuits.

## Tech stack
- React/Next.js
- Tailwind CSS
