import {
  EMPTY_FOLDERS,
  countByFolder,
  createFolder,
  deleteFolder,
  moveItems,
  pruneAssignments,
  renameFolder,
  type FavFoldersState,
} from "../utils/favFolders";

const withFolder = (name = "Vacances") => {
  const state = createFolder(EMPTY_FOLDERS, name, "airplane-outline");
  return { state, id: state.folders[0].id };
};

describe("dossiers de favoris", () => {
  it("crée un dossier avec un nom nettoyé", () => {
    const { state } = withFolder("  Vacances  ");
    expect(state.folders).toHaveLength(1);
    expect(state.folders[0].name).toBe("Vacances");
  });

  it("retombe sur un nom par défaut quand il est vide", () => {
    const state = createFolder(EMPTY_FOLDERS, "   ", "folder-outline");
    expect(state.folders[0].name).toBe("Dossier");
  });

  it("range et sort des photos d'un dossier", () => {
    const { state, id } = withFolder();
    const moved = moveItems(state, ["a", "b"], id);
    expect(moved.assign).toEqual({ a: id, b: id });

    const out = moveItems(moved, ["a"], null);
    expect(out.assign).toEqual({ b: id });
  });

  it("supprimer un dossier laisse les photos en favoris, simplement non rangées", () => {
    const { state, id } = withFolder();
    const moved = moveItems(state, ["a"], id);
    const after = deleteFolder(moved, id);
    expect(after.folders).toHaveLength(0);
    expect(after.assign).toEqual({});
  });

  it("renomme sans écraser par du vide", () => {
    const { state, id } = withFolder("Vacances");
    const renamed = renameFolder(state, id, "   ", "paw-outline");
    expect(renamed.folders[0].name).toBe("Vacances");
    expect(renamed.folders[0].icon).toBe("paw-outline");
  });

  it("purge les affectations orphelines", () => {
    const { state, id } = withFolder();
    const moved = moveItems(state, ["vivante", "disparue"], id);
    const pruned = pruneAssignments(moved, ["vivante"]);
    expect(pruned.assign).toEqual({ vivante: id });
  });

  it("ne renvoie pas un nouvel objet quand il n'y a rien à purger", () => {
    const { state, id } = withFolder();
    const moved = moveItems(state, ["a"], id);
    expect(pruneAssignments(moved, ["a"])).toBe(moved);
  });

  it("compte par dossier et distingue les photos non rangées", () => {
    const { state, id } = withFolder();
    const moved = moveItems(state, ["a", "b"], id);
    const { byFolder, unfiled } = countByFolder(moved, ["a", "b", "c"]);
    expect(byFolder[id]).toBe(2);
    expect(unfiled).toBe(1);
  });

  it("survit à un état corrompu sans planter", () => {
    const broken = { folders: [], assign: {} } as FavFoldersState;
    expect(countByFolder(broken, ["a"])).toEqual({ byFolder: {}, unfiled: 1 });
  });
});
