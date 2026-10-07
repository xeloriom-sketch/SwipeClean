import { Platform } from "react-native";
import { isUnusableUri, normalizeMediaUri, resolveMediaUri } from "../utils/mediaUri";

const setPlatform = (os: "android" | "ios") => {
  (Platform as { OS: string }).OS = os;
};

describe("isUnusableUri", () => {
  it.each([
    [undefined, true],
    [null, true],
    ["", true],
    ["file://null", true],
    ["content://media/external/images/media/42", false],
    ["file:///storage/emulated/0/DCIM/IMG_1.jpg", false],
  ])("%s -> %s", (uri, expected) => {
    expect(isUnusableUri(uri as string | null | undefined)).toBe(expected);
  });
});

describe("normalizeMediaUri (Android)", () => {
  beforeEach(() => setPlatform("android"));

  it("encode les espaces, qui cassaient Uri.parse côté lecteur vidéo", () => {
    const out = normalizeMediaUri("file:///storage/DCIM/mon fichier.jpg", "1", "photo");
    expect(out).toContain("mon%20fichier.jpg");
    expect(out).not.toContain(" ");
  });

  it("encode le dièse, qui tronquait le chemin", () => {
    const out = normalizeMediaUri("file:///storage/DCIM/photo#2.jpg", "1", "photo");
    expect(out).toContain("photo%232.jpg");
  });

  it("laisse intact un chemin déjà encodé", () => {
    const already = "file:///storage/DCIM/mon%20fichier.jpg";
    expect(normalizeMediaUri(already, "1", "photo")).toBe(already);
  });

  it("bascule sur MediaStore quand le chemin est inexploitable", () => {
    expect(normalizeMediaUri("file://null", "42", "photo")).toBe(
      "content://media/external/images/media/42"
    );
    expect(normalizeMediaUri("file://null", "42", "video")).toBe(
      "content://media/external/video/media/42"
    );
  });
});

describe("normalizeMediaUri (iOS)", () => {
  beforeEach(() => setPlatform("ios"));

  it("ne touche jamais aux URI ph://, qui sont opaques", () => {
    const uri = "ph://ABC-123/L0/001";
    expect(normalizeMediaUri(uri, "1", "photo")).toBe(uri);
  });
});

describe("resolveMediaUri", () => {
  it("renvoie null sur iOS quand le média est inexploitable", () => {
    setPlatform("ios");
    expect(resolveMediaUri("file://null", "42", "photo")).toBeNull();
    expect(resolveMediaUri(null, "42", "photo")).toBeNull();
  });

  it("renvoie un repli MediaStore sur Android", () => {
    setPlatform("android");
    expect(resolveMediaUri(null, "42", "photo")).toBe(
      "content://media/external/images/media/42"
    );
  });
});
