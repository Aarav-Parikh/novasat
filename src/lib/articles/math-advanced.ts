import { Article } from "./types";

export const advancedMathArticles: Article[] = [
  {
    slug: "equivalent-expressions",
    section: "Math",
    domain: "Advanced Math",
    title: "Equivalent Expressions",
    skill: "Equivalent expressions",
    readMinutes: 6,
    summary: "Factor, expand, and simplify polynomial and rational expressions to rewrite them in the form the question wants.",
    overview: [
      "Equivalent-expression questions ask you to rewrite something without changing its value. The tools are factoring, expanding, combining like terms, cancelling common factors, and the exponent rules xᵃ · xᵇ = xᵃ⁺ᵇ, xᵃ/xᵇ = xᵃ⁻ᵇ, and (xᵃ)ᵇ = xᵃᵇ.",
      "Memorize three patterns and you cover most of them: the difference of squares a² − b² = (a + b)(a − b), the perfect square a² ± 2ab + b² = (a ± b)², and simple trinomial factoring x² + (p + q)x + pq = (x + p)(x + q).",
      "Rational expressions simplify only through common factors, never common terms. Factor the numerator and denominator completely first, then cancel matching factors. Fractional exponents translate directly: x^(1/2) = √x and x^(m/n) is the n-th root of xᵐ.",
    ],
    tips: [
      "When choices look similar, plug in a friendly number like x = 2 into the original and each choice; only the equivalent one matches.",
      "Factor out the greatest common factor before trying anything fancier.",
      "Spot a difference of squares whenever you see two perfect squares separated by a minus sign.",
      "For a negative exponent, move the base across the fraction bar instead of changing the sign of the coefficient.",
      "Combine rational expressions with a common denominator, then factor the result to see if it simplifies.",
    ],
    pitfalls: [
      "Cancelling terms across a plus sign, as in (x + 3)/3 becoming x.",
      "Distributing an exponent over addition: (x + y)² is not x² + y².",
      "Losing a negative sign when factoring out −1.",
    ],
    problems: [
      {
        prompt: "Which expression is equivalent to (4x² − 9)/(2x + 3) for 2x + 3 ≠ 0?",
        choices: ["2x − 3", "2x + 3", "4x − 3", "2x² − 3"],
        correct: 0,
        explanation: "4x² − 9 is a difference of squares: (2x + 3)(2x − 3). Cancelling the common factor 2x + 3 leaves 2x − 3.",
      },
      {
        prompt: "Which expression is equivalent to (3x³y⁻²)²?",
        choices: ["9x⁶y⁻⁴", "6x⁵y⁻⁴", "9x⁶y⁴", "3x⁶y⁻⁴"],
        correct: 0,
        explanation: "Square each factor: 3² = 9, (x³)² = x⁶, and (y⁻²)² = y⁻⁴, giving 9x⁶y⁻⁴, or 9x⁶/y⁴.",
      },
      {
        prompt: "If x² + bx + 24 = (x + 4)(x + c), what is the value of b?",
        choices: ["6", "8", "10", "12"],
        correct: 2,
        explanation: "The constants multiply to 24, so 4c = 24 and c = 6. Then b = 4 + 6 = 10.",
      },
    ],
  },
  {
    slug: "nonlinear-equations-and-systems",
    section: "Math",
    domain: "Advanced Math",
    title: "Nonlinear Equations and Nonlinear Systems",
    skill: "Nonlinear equations in one variable and systems of equations in two variables",
    readMinutes: 7,
    summary: "Solve quadratics four ways, use the discriminant, and handle systems where a line meets a curve.",
    overview: [
      "Every quadratic ax² + bx + c = 0 can be solved by factoring, by taking square roots, by completing the square, or by the quadratic formula x = (−b ± √(b² − 4ac))/(2a). Try factoring for about ten seconds; if nothing clicks, go straight to the formula.",
      "The discriminant b² − 4ac tells you the number of real solutions without solving: positive means two, zero means exactly one, negative means none. Questions that ask for the value of a constant giving exactly one solution are discriminant questions in disguise.",
      "A nonlinear system usually pairs a line with a parabola or circle. Substitute the linear equation into the nonlinear one, collect everything on one side, and solve the resulting quadratic. The number of intersection points equals the number of real solutions.",
      "Radical and rational equations can produce extraneous solutions. After squaring both sides or clearing a denominator, always substitute each candidate back into the original equation.",
    ],
    tips: [
      "The sum of a quadratic's roots is −b/a and the product is c/a — fast when a question asks only for one of those.",
      "For x² = k, remember both roots: x = ±√k.",
      "Set the discriminant equal to zero for tangency or 'exactly one solution' questions.",
      "In a system, subtracting the equations is sometimes faster than substituting.",
      "Graphing on the built-in calculator can confirm the number of intersections in seconds.",
    ],
    pitfalls: [
      "Dropping the negative root when taking a square root.",
      "Forgetting to check for extraneous solutions after squaring.",
      "Applying the quadratic formula with a, b, or c taken before moving everything to one side.",
    ],
    problems: [
      {
        prompt: "What are the solutions to x² − 6x + 5 = 0?",
        choices: ["x = 1 and x = 5", "x = −1 and x = −5", "x = 2 and x = 3", "x = 0 and x = 6"],
        correct: 0,
        explanation: "Factor as (x − 1)(x − 5) = 0, so x = 1 or x = 5. Their sum 6 matches −b/a and their product 5 matches c/a.",
      },
      {
        prompt: "For what positive value of k does x² + kx + 9 = 0 have exactly one real solution?",
        choices: ["3", "6", "9", "18"],
        correct: 1,
        explanation: "One solution means the discriminant is zero: k² − 4(1)(9) = 0, so k² = 36 and the positive value is k = 6.",
      },
      {
        prompt: "How many points do y = x² + 2 and y = 3x intersect at?",
        choices: ["0", "1", "2", "Infinitely many"],
        correct: 2,
        explanation: "Setting x² + 2 = 3x gives x² − 3x + 2 = 0, whose discriminant is 9 − 8 = 1 > 0, so there are two intersection points (x = 1 and x = 2).",
      },
    ],
  },
  {
    slug: "nonlinear-functions",
    section: "Math",
    domain: "Advanced Math",
    title: "Nonlinear Functions",
    skill: "Nonlinear functions",
    readMinutes: 7,
    summary: "Read vertex, zeros, and growth behavior from quadratic, exponential, and other nonlinear function forms.",
    overview: [
      "Quadratics come in three useful forms. Standard form y = ax² + bx + c shows the y-intercept c. Factored form y = a(x − r₁)(x − r₂) shows the zeros. Vertex form y = a(x − h)² + k shows the vertex (h, k), which is the maximum when a < 0 and the minimum when a > 0. The axis of symmetry is x = −b/(2a).",
      "Exponential functions y = a·bˣ change by a constant factor per step rather than a constant amount. If b > 1 the function grows; if 0 < b < 1 it decays. The starting value a is the output at x = 0, and a growth rate of r percent per period means b = 1 + r/100.",
      "Transformations are predictable: f(x) + k shifts up, f(x + h) shifts left, −f(x) reflects over the x-axis, and a coefficient greater than 1 stretches vertically.",
    ],
    tips: [
      "To find the vertex fast, compute x = −b/(2a) and plug it back in for the y-value.",
      "Linear means constant difference; exponential means constant ratio. Check a table both ways.",
      "The zeros of a factored quadratic are the values that make each factor zero — read them off, do not expand.",
      "For 'doubles every 6 years', write the model as a·2^(t/6) instead of guessing a decimal base.",
      "Sketch or graph the function on the calculator when a question describes behavior in words.",
    ],
    pitfalls: [
      "Reading the vertex of y = (x − 4)² + 3 as (−4, 3).",
      "Treating a constant percent increase as a linear model.",
      "Confusing the maximum value k with the x-coordinate h.",
    ],
    problems: [
      {
        prompt: "The function f(x) = −2(x − 3)² + 20 models the height of a ball. What is the maximum height?",
        choices: ["3", "17", "20", "23"],
        correct: 2,
        explanation: "The function is in vertex form with a = −2 < 0, so the vertex (3, 20) is a maximum. The maximum height is 20.",
      },
      {
        prompt: "A population of 400 bacteria triples every 5 hours. Which function gives the population after t hours?",
        choices: ["P(t) = 400 + 3t", "P(t) = 400 · 3^(5t)", "P(t) = 400 · 3^(t/5)", "P(t) = 400 · 5^(t/3)"],
        correct: 2,
        explanation: "Tripling every 5 hours means the exponent must be t/5, so P(t) = 400 · 3^(t/5). At t = 5 this gives 1200, as required.",
      },
      {
        prompt: "What are the x-intercepts of y = (x + 6)(x − 2)?",
        choices: ["(6, 0) and (−2, 0)", "(−6, 0) and (2, 0)", "(0, −6) and (0, 2)", "(−6, 0) and (−2, 0)"],
        correct: 1,
        explanation: "Set each factor to zero: x + 6 = 0 gives x = −6, and x − 2 = 0 gives x = 2. The intercepts are (−6, 0) and (2, 0).",
      },
    ],
  },
];
