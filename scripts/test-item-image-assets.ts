import assert from "node:assert/strict";

import { ABILITY_TM_IMAGE } from "../src/lib/abilities/tm";
import { eggImageUrl } from "../src/lib/egg-origin";
import { mascotOriginIcon } from "../src/lib/mascot-origin-icons";

const ASSET_BASE = "https://fwxqywivezsixamietps.supabase.co/storage/v1/render/image/public/assets/items";
const LAB_EGG_IMAGE = `${ASSET_BASE}/lab-egg-v1.webp?width=256&quality=85&format=webp`;
const ABILITY_TM_ART = `${ASSET_BASE}/ability-tm-v1.webp?width=256&quality=85&format=webp`;

function assertExistingLabEggUsesNewArtwork() {
  assert.equal(
    eggImageUrl("LAB"),
    LAB_EGG_IMAGE,
    "Ovos de laboratório já presentes no inventário precisam usar a nova arte pelo tipo do ovo.",
  );
  assert.equal(
    mascotOriginIcon("LAB")?.url,
    LAB_EGG_IMAGE,
    "A origem exibida em mascotes já existentes precisa usar a nova arte do ovo de laboratório.",
  );
}

function assertAbilityTmsUseTheHostedArtwork() {
  assert.equal(
    ABILITY_TM_IMAGE,
    ABILITY_TM_ART,
    "TMs de habilidade da loja e do inventário precisam usar a arte hospedada no Supabase.",
  );
}

assertExistingLabEggUsesNewArtwork();
assertAbilityTmsUseTheHostedArtwork();
console.log("Item image asset behavior is valid.");
