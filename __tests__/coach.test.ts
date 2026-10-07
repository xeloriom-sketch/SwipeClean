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

  it("ignore le swipe vers le bas, qui ne décide rien", () => {
    // Sans ça, neuf swipes vers le bas « terminaient » le tutoriel sans qu'aucun des
    // trois gestes enseignés n'ait été fait.
    let state = INITIAL_COACH;
    for (let i = 0; i < 9; i++) state = advanceCoach(state, "bottom");
    expect(state).toEqual(INITIAL_COACH);
  });

  it("ne compte pas un essai sur un swipe vers le bas", () => {
    const after = advanceCoach({ step: 0, attempts: 2 }, "bottom");
    expect(after.attempts).toBe(2);
    expect(after.step).toBe(0);
  });

  it("isExpected est faux sur une direction qui n'est pas celle demandée", () => {
    expect(isExpected(INITIAL_COACH, "right")).toBe(false);
    expect(isExpected(INITIAL_COACH, "bottom")).toBe(false);
  });

  it("chaque étape a une consigne et une conséquence non vides", () => {
    for (const step of COACH_STEPS) {
      expect(step.gesture.trim().length).toBeGreaterThan(0);
      expect(step.detail.trim().length).toBeGreaterThan(0);
      expect(step.done.trim().length).toBeGreaterThan(0);
    }
  });
});
