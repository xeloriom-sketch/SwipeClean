import {
  COACH_STEPS,
  INITIAL_COACH,
  MAX_ATTEMPTS_PER_STEP,
  advanceCoach,
  isExpected,
} from "../utils/coach";

describe("tutoriel guidé", () => {
  it("avance d'une étape quand le bon geste est fait", () => {
    const state = advanceCoach(INITIAL_COACH, COACH_STEPS[0].dir);
    expect(state.step).toBe(1);
    expect(state.attempts).toBe(0);
  });

  it("reste sur l'étape quand le geste n'est pas celui demandé", () => {
    const wrong = COACH_STEPS[0].dir === "left" ? "right" : "left";
    const state = advanceCoach(INITIAL_COACH, wrong);
    expect(state.step).toBe(0);
    expect(state.attempts).toBe(1);
  });

  it("ne retient jamais quelqu'un: on avance après assez d'essais ratés", () => {
    const wrong = COACH_STEPS[0].dir === "left" ? "right" : "left";
    let state = INITIAL_COACH;
    for (let i = 0; i < MAX_ATTEMPTS_PER_STEP; i++) {
      state = advanceCoach(state, wrong);
    }
    expect(state.step).toBe(1);
  });

  it("se termine après la dernière étape", () => {
    let state = INITIAL_COACH;
    for (const step of COACH_STEPS) {
      state = advanceCoach(state, step.dir);
    }
    expect(state.step).toBeNull();
  });

  it("ignore les gestes une fois terminé", () => {
    const finished = { step: null, attempts: 0 };
    expect(advanceCoach(finished, "left")).toEqual(finished);
  });

  it("reconnaît le geste attendu", () => {
    expect(isExpected(INITIAL_COACH, COACH_STEPS[0].dir)).toBe(true);
    expect(isExpected({ step: null, attempts: 0 }, "left")).toBe(false);
  });

  it("couvre les trois gestes de base, chacun une seule fois", () => {
    const dirs = COACH_STEPS.map((s) => s.dir);
    expect(dirs).toEqual(["left", "right", "top"]);
    expect(new Set(dirs).size).toBe(dirs.length);
  });
});
