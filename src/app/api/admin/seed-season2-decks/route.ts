/**
 * Importa decklists da 2a Edicao como SavedDecks publicos.
 * GET /api/admin/seed-season2-decks
 * Idempotente — verifica existencia antes de criar.
 * Semana 6 (Construtor Misterioso) nao tem deck data disponivel.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

// Converte formato da planilha (<br>) para texto PTCG limpo
const d = (raw: string) =>
  raw.replace(/<br>/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

// ── Definicao dos decks por jogador / semana ──────────────────────────────────

const DECKS: Array<{
  player: string;   // displayName normalizado (sem acento p/ match)
  week: number;
  name: string;
  archetype: string;
  deckList: string;
}> = [
  // ── SEMANA 1 — Padrão ────────────────────────────────────────────────────
  {
    player: "Luiz", week: 1, name: "S1 — Slaking ex / Pidgeot ex", archetype: "Slaking ex",
    deckList: d(`Pokémon: 16<br>2 Pidgeotto MEW 17<br>1 Vigoroth PAL 161<br>3 Slakoth PAL 160<br>1 Dusclops SFA 69<br>1 Pidgey MEW 16<br>1 Fezandipiti ex SFA 92<br>1 Bloodmoon Ursaluna ex TWM 141<br>2 Slaking ex SSP 147<br>1 Duskull PRE 35<br>1 Dusknoir SFA 70<br>2 Pidgeot ex OBF 164<br>1 Pidgey OBF 162<br>1 Budew PRE 4<br>1 Fan Rotom SCR 118<br>1 Fan Rotom SCR 118 PH<br>1 Duskull SFA 68<br><br>Treinador: 20<br>1 Colress's Tenacity SFA 57<br>1 Artazon OBF 229<br>1 Colress's Tenacity SFA 87<br>1 Sacred Ash DRI 168<br>1 Counter Catcher PAR 264<br>2 Colress's Tenacity SFA 57 PH<br>2 Lillie's Determination MEG 119<br>1 Lillie's Determination MEG 169<br>1 Team Rocket's Watchtower DRI 180<br>1 Buddy-Buddy Poffin MEG 167<br>1 Grand Tree SCR 136<br>2 Boss's Orders PAL 248<br>3 Rare Candy GRI 165<br>1 Iono PAL 254<br>4 Ultra Ball BRS 186<br>1 Boss's Orders PAL 265<br>1 Iono PAF 237<br>1 Black Belt's Training JTG 145<br>3 Buddy-Buddy Poffin TWM 223<br>1 Hilda WHT 171<br><br>Energia: 5<br>1 Ignition Energy WHT 86<br>4 Jet Energy PAL 190<br>1 Boomerang Energy TWM 166 PH<br>1 Boomerang Energy TWM 166<br>2 Ignition Energy WHT 86 PH`)
  },
  {
    player: "Luiz", week: 1, name: "S1 — Empoleon ex / Metagross", archetype: "Empoleon ex",
    deckList: d(`Pokémon: 8<br>1 Genesect ex BLK 67<br>3 Empoleon ex PFL 70<br>3 Piplup PFL 27<br>1 Mega Mawile ex MEG 162<br>3 Beldum TEF 113<br>3 Metang TEF 114<br>2 Prinplup PFL 28<br>2 Wellspring Mask Ogerpon ex TWM 64<br><br>Treinador: 19<br>2 Buddy-Buddy Poffin TWM 223<br>2 Iono PAL 254<br>1 Rare Candy GRI 165<br>1 Battle Cage PFL 85 PH<br>1 Lillie's Determination MEG 169<br>1 Super Rod PAL 276<br>1 Air Balloon MEG 166<br>1 Buddy-Buddy Poffin MEG 167<br>2 Nest Ball SVI 255<br>1 Hero's Cape TEF 152<br>4 Arven PAF 235<br>2 Full Metal Lab TEF 148 PH<br>1 Rare Candy MEG 175<br>2 Boss's Orders PAL 248<br>1 Technical Machine: Evolution PAR 178<br>1 Energy Search SSH 161<br>1 Counter Catcher PAR 264<br>1 Professor's Research SVI 240<br>3 Lillie's Determination MEG 119<br><br>Energia: 2<br>2 Basic {W} Energy SVE 3 PH<br>11 Basic {M} Energy SVE 16`)
  },
  {
    player: "Luiz", week: 1, name: "S1 — Tauros", archetype: "Tauros",
    deckList: d(`Pokémon: 3<br>1 Tauros MEW 128<br>3 Tauros MEW 128 PH<br>4 Paldean Tauros PFL 48 PH<br><br>Treinador: 23<br>2 Fighting Gong MEG 116<br>1 Iono PAL 254<br>1 Secret Box TWM 163<br>2 Hassel TWM 151 PH<br>1 Team Rocket's Venture Bomb DRI 179<br>1 Lillie's Determination MEG 169<br>1 Super Rod PAL 276<br>1 Air Balloon MEG 166<br>1 Air Balloon BLK 79 PH<br>4 Nest Ball SVI 255<br>3 Premium Power Pro MEG 124<br>4 Risky Ruins MEG 127<br>2 Arven PAF 235<br>1 Iono PAF 237<br>1 Boss's Orders PAL 265<br>4 Night Stretcher SSP 251<br>2 Boss's Orders PAL 248<br>1 Premium Power Pro MEG 124 PH<br>1 Counter Catcher PAR 264<br>4 Professor's Research SVI 240<br>2 Brave Bangle WHT 80<br>3 Lillie's Determination MEG 119<br>2 Fighting Gong MEG 116 PH<br><br>Energia: 1<br>7 Basic {F} Energy GRI 169`)
  },
  {
    player: "Rodrigo", week: 1, name: "S1 — Meganium / Mega Venusaur / Ogerpon", archetype: "Meganium",
    deckList: d(`Pokémon: 16<br>1 Teal Mask Ogerpon ex PRE 145<br>1 Toedscool PAR 16<br>1 Lombre PFL 6 PH<br>2 Meganium MEG 10<br>1 Ludicolo PFL 95<br>2 Teal Mask Ogerpon ex TWM 190<br>1 Lotad PFL 5 PH<br>1 Mega Venusaur ex MEG 177<br>2 Bayleef MEG 9<br>2 Chikorita MEG 8<br>1 Mega Venusaur ex MEG 155<br>1 Toedscruel PAR 185<br>1 Shaymin DRI 185<br>2 Bulbasaur MEG 133<br>2 Ivysaur MEG 134<br>1 Budew PRE 4 PH<br><br>Treinador: 17<br>3 Forest of Vitality MEG 117<br>2 Bug Catching Set TWM 143<br>4 Lillie's Determination MEG 169<br>1 Superior Energy Retrieval PAL 277<br>2 Nest Ball SVI 255<br>1 Hero's Cape TEF 152<br>2 Arven PAF 235<br>2 Boss's Orders PAL 265<br>1 Night Stretcher SSP 251<br>1 Wally's Compassion MEG 176<br>1 Bravery Charm SCR 175<br>3 Ultra Ball BRS 186<br>1 Bug Catching Set PRE 102<br>1 Counter Catcher PAR 264<br>1 Brave Bangle WHT 80<br>1 Bug Catching Set PRE 102 PH<br>1 Air Balloon SSH 213<br><br>Energia: 1<br>10 Basic {G} Energy SVE 17`)
  },
  {
    player: "Moises", week: 1, name: "S1 — Mega Gengar / Mega Sharpedo", archetype: "Mega Gengar ex",
    deckList: d(`Pokémon: 10<br>1 Seviper PFL 62<br>1 Munkidori SFA 72<br>3 Carvanha PFL 60<br>2 Toxel PFL 67<br>2 Gastly TEF 102 PH<br>2 Haunter PFL 55<br>1 Mega Sharpedo ex PFL 127<br>2 Toxtricity PFL 103<br>2 Mega Gengar ex PFL 56<br>2 Mega Sharpedo ex PFL 113<br><br>Treinador: 23<br>2 Buddy-Buddy Poffin TWM 223<br>3 Lillie's Determination MEG 184<br>1 Unfair Stamp TWM 165<br>1 Super Rod PAL 276<br>1 Air Balloon MEG 166<br>2 Nest Ball SVI 255<br>2 Earthen Vessel SFA 96<br>1 Dawn PFL 129<br>1 Punk Helmet PFL 121<br>2 Grimsley's Move PFL 120<br>2 Risky Ruins MEG 127<br>2 Arven PAF 235<br>1 Iono PAF 237<br>1 Pokégear 3.0 UNB 233<br>1 Mega Signal MEG 121 PH<br>2 Boss's Orders PAL 265<br>1 Rare Candy MEG 175<br>1 Night Stretcher SSP 251<br>1 Hilda WHT 171<br>1 Technical Machine: Evolution PAR 178<br>2 Ultra Ball BRS 186<br>1 Super Rod PAL 188<br>1 Battle Cage PFL 116<br><br>Energia: 2<br>6 Basic {D} Energy BUS 168<br>3 Basic {D} Energy SVE 15`)
  },
  {
    player: "Moises", week: 1, name: "S1 — Meganium / Celebi / Mega Venusaur", archetype: "Meganium",
    deckList: d(`Pokémon: 9<br>4 Teal Mask Ogerpon ex TWM 25<br>2 Celebi MEG 12<br>2 Meganium MEG 10<br>2 Bayleef MEG 9<br>2 Chikorita MEG 8<br>3 Mega Venusaur ex MEG 3<br>2 Ivysaur MEG 2<br>1 Ivysaur MEG 134<br>3 Bulbasaur SCR 143<br><br>Treinador: 17<br>4 Forest of Vitality MEG 117<br>1 Counter Catcher PAR 160<br>3 Bug Catching Set TWM 143<br>1 Lillie's Determination MEG 184<br>1 Night Stretcher SFA 61<br>2 Nest Ball SVI 181<br>1 Iono PAF 237<br>2 Air Balloon BLK 79<br>2 Boss's Orders PAL 265<br>3 Arven SVI 166<br>1 Hilda WHT 84 PH<br>1 Hilda WHT 171<br>1 Super Rod PAL 188<br>1 Earthen Vessel PRE 106<br>2 Buddy-Buddy Poffin TEF 144<br>2 Lillie's Determination MEG 119<br>1 Ultra Ball MEG 131<br><br>Energia: 1<br>10 Basic {G} Energy SVE 1`)
  },
  {
    player: "Erick", week: 1, name: "S1 — Dragapult ex", archetype: "Dragapult ex",
    deckList: d(`Pokémon: 8<br>2 Dreepy PRE 71<br>1 Dusknoir PRE 37<br>4 Drakloak PRE 72<br>2 Dreepy TWM 128<br>1 Munkidori TWM 95<br>3 Dragapult ex TWM 130<br>2 Dusclops PRE 36<br>2 Duskull SFA 18<br><br>Treinador: 17<br>4 Buddy-Buddy Poffin PRE 101<br>2 Crispin PRE 105<br>1 Xerosic's Machinations SFA 64<br>1 Briar SCR 132<br>2 Lillie's Determination MEG 119<br>1 Counter Catcher PAR 160<br>1 Handheld Fan TWM 150<br>2 Iono PAL 185<br>1 Air Balloon BLK 79<br>3 Boss's Orders MEG 114<br>2 Night Stretcher SFA 61<br>1 Professor Turo's Scenario PRE 121<br>2 Dawn PFL 87<br>2 Tera Orb SSP 189<br>1 Artazon PAL 171<br>4 Arven SVI 166<br>4 Rare Candy MEG 125<br><br>Energia: 4<br>2 Basic {P} Energy Energy 13<br>2 Basic {R} Energy Energy 10<br>4 Luminous Energy PAL 191<br>1 Neo Upper Energy TEF 162`)
  },
  {
    player: "Cristian", week: 1, name: "S1 — Greninja ex / Charizard ex", archetype: "Greninja ex",
    deckList: d(`Pokémon: 11<br>1 Charmeleon PAF 8<br>3 Greninja ex TWM 106<br>1 Dusclops PRE 36<br>1 Duskull SFA 68<br>1 Duskull SFA 18<br>1 Frogadier SCR 40<br>3 Charmander MEW 4<br>1 Dusknoir SFA 70<br>1 Dusknoir SFA 20<br>3 Charizard ex OBF 125<br>3 Froakie OBF 56<br><br>Treinador: 15<br>1 Rare Candy SVI 256<br>1 Technical Machine: Evolution PAR 178<br>2 Boss's Orders PAL 265<br>3 Lillie's Determination MEG 119<br>1 Counter Catcher PAR 160<br>1 Prime Catcher TEF 157<br>3 Arven PAF 235<br>2 Air Balloon BLK 79<br>3 Ultra Ball BRS 186<br>2 Dawn PFL 129<br>2 Premium Power Pro MEG 124<br>3 Buddy-Buddy Poffin TWM 223<br>2 Rare Candy GRI 165<br>2 Hilda WHT 84<br>1 Super Rod PAL 188<br><br>Energia: 2<br>6 Basic {W} Energy SVE 11<br>6 Basic {R} Energy MEE 2`)
  },
  {
    player: "Cristian", week: 1, name: "S1 — Cynthia's Lucario / Mega Lucario", archetype: "Mega Lucario ex",
    deckList: d(`Pokémon: 12<br>2 Solrock MEG 75<br>2 Makuhita MEG 72<br>2 Cynthia's Gible DRI 102<br>1 Cynthia's Garchomp ex DRI 104<br>2 Cynthia's Garchomp ex DRI 232<br>2 Cynthia's Gabite DRI 103 PH<br>2 Mega Lucario ex MEG 77<br>2 Lunatone MEG 74<br>3 Riolu MEG 76<br>1 Cynthia's Gible DRI 102 PH<br>2 Bloodmoon Ursaluna PRE 54<br>2 Hariyama MEG 73<br><br>Treinador: 14<br>1 Rare Candy SVI 256<br>3 Lillie's Determination MEG 119<br>2 Air Balloon BLK 79<br>2 Boss's Orders MEG 114<br>4 Fighting Gong MEG 116<br>2 Cynthia's Power Weight DRI 162 PH<br>1 Night Stretcher SFA 61<br>1 Counter Catcher CIN 91<br>1 Rare Candy GRI 165<br>1 Scoop Up Cyclone TWM 162<br>2 Dawn PFL 87<br>1 Calamitous Wasteland PAL 175<br>3 Arven SVI 166<br>4 Premium Power Pro MEG 124<br><br>Energia: 1<br>9 Basic {F} Energy Energy 14`)
  },
  {
    player: "Alan", week: 1, name: "S1 — Team Rocket's Crobat ex", archetype: "Team Rocket's Crobat ex",
    deckList: d(`Pokémon: 10<br>1 Team Rocket's Mimikyu SVALT 180<br>4 Team Rocket's Zubat DRI 120 PH<br>2 Team Rocket's Spidops DRI 20<br>1 Team Rocket's Golbat DRI 121 PH<br>1 Team Rocket's Sneasel DRI 128<br>3 Team Rocket's Golbat DRI 121<br>2 Team Rocket's Spidops DRI 187<br>3 Team Rocket's Tarountula DRI 19<br>1 Team Rocket's Mimikyu DRI 87<br>2 Team Rocket's Crobat ex DRI 234<br><br>Treinador: 16<br>2 Counter Catcher PAR 160<br>1 Team Rocket's Archer DRI 170<br>1 Team Rocket's Transceiver DRI 178 PH<br>1 Energy Switch SVI 173<br>2 Team Rocket's Giovanni DRI 174<br>2 Night Stretcher SFA 61<br>3 Team Rocket's Factory DRI 173<br>2 Team Rocket's Proton DRI 177 PH<br>3 Team Rocket's Transceiver DRI 178<br>2 Iono PAL 185<br>1 Team Rocket's Ariana DRI 171<br>3 Team Rocket's Ariana DRI 171 PH<br>1 Team Rocket's Proton DRI 177<br>4 Ultra Ball SVI 196<br>1 Neutralization Zone SFA 60<br>2 Earthen Vessel PAR 163<br><br>Energia: 3<br>4 Basic {G} Energy SVE 1<br>1 Basic {D} Energy SVE 15<br>4 Team Rocket's Energy DRI 182`)
  },
  {
    player: "Alan", week: 1, name: "S1 — Mismagius ex / Brambleghast", archetype: "Mismagius ex",
    deckList: d(`Pokémon: 9<br>3 Mismagius ex PFL 36<br>3 Bramblin PFL 46<br>1 Bloodmoon Ursaluna ex TWM 216<br>1 Tatsugiri TWM 131<br>4 Misdreavus PFL 35<br>1 Fezandipiti ex SFA 38<br>1 Budew PRE 4<br>1 Lillie's Clefairy ex JTG 56<br>3 Brambleghast PFL 47<br><br>Treinador: 15<br>3 Buddy-Buddy Poffin PRE 101<br>1 Earthen Vessel PRE 106<br>3 Judge SVI 176<br>2 Arven OBF 186<br>1 Defiance Band SVI 169<br>4 Lillie's Determination MEG 119<br>4 Dizzying Valley PFL 88<br>1 Air Balloon BLK 79<br>2 Boss's Orders MEG 114<br>1 Night Stretcher SFA 61<br>4 Ultra Ball MEG 131<br>3 Nest Ball SVI 181<br>1 Secret Box TWM 163<br>2 Strange Timepiece MEG 128<br>2 Wondrous Patch PFL 94<br><br>Energia: 1<br>8 Basic {P} Energy SVE 5`)
  },
  {
    player: "Alan", week: 1, name: "S1 — Dragapult ex / Team Rocket's Crobat", archetype: "Dragapult ex",
    deckList: d(`Pokémon: 8<br>1 Shaymin DRI 10<br>2 Team Rocket's Crobat ex DRI 122<br>2 Team Rocket's Golbat DRI 121<br>4 Drakloak TWM 129<br>4 Dreepy TWM 128<br>2 Dragapult ex TWM 130<br>1 Budew PRE 4<br>2 Team Rocket's Zubat DRI 120<br><br>Treinador: 17<br>1 Earthen Vessel PRE 106<br>2 Rare Candy PAF 89<br>3 Ultra Ball PAF 91<br>1 Crispin PRE 105<br>1 Exp. Share SVI 174<br>4 Arven OBF 186<br>4 Buddy-Buddy Poffin TEF 144<br>2 Counter Catcher PAR 160<br>1 Technical Machine: Devolution PAR 177<br>3 Night Stretcher SFA 61<br>1 Technical Machine: Evolution PAR 178<br>4 Iono PAF 80<br>1 Professor Turo's Scenario PRE 121<br>1 Rescue Board TEF 159<br>2 Nest Ball PAF 84<br>2 Artazon PAL 171<br>1 Boss's Orders PAL 172<br><br>Energia: 4<br>1 Team Rocket's Energy DRI 182<br>3 Basic {P} Energy MEE 5<br>3 Basic {R} Energy MEE 2<br>1 Neo Upper Energy TEF 162`)
  },
  {
    player: "Nakaima", week: 1, name: "S1 — Mega Absol ex / Mega Gengar ex", archetype: "Mega Absol ex",
    deckList: d(`Pokémon: 15<br>1 Mega Absol ex MEG 86<br>1 Seviper PFL 62<br>1 Carvanha PFL 60<br>1 Sableye PFL 59<br>2 Toxel PFL 67<br>1 Absol PFL 63 PH<br>1 Haunter MEP 27<br>1 Mega Sharpedo ex PFL 127<br>1 Fezandipiti ex SFA 38<br>1 Yveltal MEG 88 PH<br>1 Gastly TEF 177<br>2 Toxtricity PFL 68<br>1 Pecharunt ex SFA 39<br>2 Mega Gengar ex PFL 56<br>1 Gastly PFL 54<br><br>Treinador: 24<br>1 Energy Switch MEG 115 PH<br>2 Punk Helmet PFL 92<br>1 Hassel TWM 205<br>2 Lillie's Determination MEG 184<br>1 Dawn PFL 87<br>2 Nest Ball PAF 84<br>1 Max Rod PRE 116<br>1 Energy Retrieval SVI 171<br>1 Night Stretcher SFA 61<br>1 Pokégear 3.0 BLK 84<br>1 Rare Candy MEG 125<br>1 Switch CES 147 PH<br>1 Risky Ruins MEG 127<br>1 Ultra Ball ROS 93 PH<br>2 Arven OBF 186<br>1 Mega Signal MEG 171<br>1 Iono PAL 269<br>1 Super Rod PAL 188<br>1 Buddy-Buddy Poffin TEF 144<br>1 Ciphermaniac's Codebreaking TEF 145<br>1 Ultra Ball MEG 131<br>2 Boss's Orders MEG 114<br>1 Miriam SVI 251<br>1 Switch PFL 123<br><br>Energia: 1<br>13 Basic {D} Energy MEE 7`)
  },
  // ── SEMANA 2 — GLC ────────────────────────────────────────────────────────
  {
    player: "Luiz", week: 2, name: "S2 GLC — Luta / Terra", archetype: "GLC Luta",
    deckList: d(`Pokémon: 15<br>1 Lunatone MEG 74<br>1 Solrock MEG 75<br>1 Hariyama MEG 73<br>1 Makuhita MEG 72 PH<br>1 Mudbray DRI 107 PH<br>1 Mudsdale DRI 108<br>1 Falinks SCR 88<br>1 Rhyperior SCR 76<br>1 Rhydon SCR 75<br>1 Rhyhorn SCR 74<br>1 Machamp MEW 68<br>1 Machoke MEW 67<br>1 Machop MEW 66<br>1 Lucario SVI 114<br>1 Riolu MEG 76<br><br>Treinador: 32<br>1 Lana's Aid TWM 207<br>1 Nest Ball SUM 158<br>1 Arven PAF 235<br>1 Luxurious Cape PAR 166<br>1 Rocky Helmet SVI 193<br>1 Punk Helmet PFL 92<br>1 Brock's Scouting JTG 146<br>1 Giovanni's Charisma MEW 197<br>1 Defiance Vest PAR 162<br>1 Lillie's Determination MEG 169<br>1 Calamitous Wasteland PAL 175<br>1 Fighting Gong MEG 116<br>1 Hilda WHT 171<br>1 Iono PAF 237<br>1 Technical Machine: Turbo Energize PAR 179<br>1 Technical Machine: Evolution PAR 178<br>1 Boss's Orders PAL 248<br>1 Buddy-Buddy Poffin MEG 167<br>1 Pokégear 3.0 SVI 186<br>1 Super Rod PAL 276<br>1 Premium Power Pro MEG 124 PH<br>1 Colress's Tenacity SFA 87<br>1 Energy Search SVI 172<br>1 Dawn PFL 129<br>1 TM Machine DRI 181<br>1 Night Stretcher SSP 251<br>1 Enhanced Hammer TWM 148<br>1 Crushing Hammer SVI 168<br>1 Hassel TWM 205<br>1 Earthen Vessel SFA 96<br>1 Tool Scrapper WHT 85<br>1 Town Store OBF 196<br><br>Energia: 4<br>1 Spiky Energy JTG 159<br>1 Mist Energy TEF 161<br>1 Jet Energy PAL 190<br>10 Basic {F} Energy GRI 169`)
  },
  {
    player: "Luiz", week: 2, name: "S2 GLC — Fogo (Blaziken)", archetype: "GLC Fogo",
    deckList: d(`Pokémon: 17<br>1 Cinderace MEG 28<br>1 Blaziken DRI 42<br>1 Combusken DRI 41<br>1 Combusken JTG 23 PH<br>1 Victini SSP 21<br>1 Emboar WHT 13<br>1 Pignite WHT 97<br>1 Tepig WHT 11 PH<br>1 Rapidash DRI 189<br>1 Ponyta DRI 29<br>1 Moltres MEW 146<br>1 Houndoom SFA 8<br>1 Houndour SFA 7 PH<br>1 Skeledirge SSP 31 PH<br>1 Crocalor PAR 24<br>1 Fuecoco SSP 29<br>1 Gouging Fire SSP 38<br><br>Treinador: 30<br>1 Energy Sticker MEW 159<br>1 Ethan's Adventure DRI 236<br>1 Arven PAF 235<br>1 Nest Ball SUM 158<br>1 Energy Search SVI 172<br>1 Brock's Scouting JTG 179<br>1 Firebreather PFL 119<br>1 Lillie's Determination MEG 169<br>1 Dawn PFL 129<br>1 Ciphermaniac's Codebreaking PRE 104 PH<br>1 Hilda WHT 171<br>1 Jacq SVI 175 PH<br>1 Iono PAL 254<br>1 Judge DRI 222<br>1 Night Stretcher SSP 251<br>1 Technical Machine: Evolution PAR 178<br>1 TM Machine DRI 181<br>1 Friends in Paldea PRE 137<br>1 Hassel TWM 205<br>1 Boss's Orders PAL 248<br>1 Counter Catcher PAR 264<br>1 Buddy-Buddy Poffin MEG 167<br>1 Earthen Vessel PAR 163 PH<br>1 Super Rod PAL 276<br>1 Switch MEW 206<br>1 Technical Machine: Turbo Energize PAR 179<br>1 Redeemable Ticket JTG 156 PH<br>1 Colbur Berry SSP 168<br>1 Rare Candy SVI 256<br>1 Crispin PRE 171<br><br>Energia: 5<br>6 Basic {R} Energy OBF 230<br>1 Basic {R} Energy SVE 10 PH<br>3 Basic {R} Energy SVE 2 PH<br>1 Boomerang Energy TWM 166<br>2 Basic {M} Energy SVE 8`)
  },
  {
    player: "Moises", week: 2, name: "S2 GLC — Elétrico (Raichu)", archetype: "GLC Elétrico",
    deckList: d(`Pokémon: 19<br>1 Bellibolt OBF 77<br>1 Zebstrika WHT 32<br>1 Minun PAR 61 PH<br>1 Raichu TEF 52<br>1 Pawmo PAL 75<br>1 Blitzle SSP 62<br>1 Magneton SSP 59<br>1 Tadbulb OBF 76<br>1 Plusle PAR 60<br>1 Emolga BLK 29<br>1 Joltik SCR 50<br>1 Pawmi PAL 74<br>1 Galvantula WHT 34<br>1 Pawmot PAL 76<br>1 Magnemite SSP 58<br>1 Pachirisu MEG 51<br>1 Pikachu PAL 62<br>1 Ethan's Pichu DRI 71<br>1 Raikou MEG 48<br><br>Treinador: 31<br>1 Drayton SSP 232<br>1 Buddy-Buddy Poffin TWM 223<br>1 Youngster SVI 198<br>1 Lacey SCR 166<br>1 Iris's Fighting Spirit JTG 180<br>1 Lillie's Determination MEG 184<br>1 Crushing Hammer UPR 166<br>1 Super Rod PAL 276<br>1 Artazon OBF 229<br>1 Energy Search SVI 172<br>1 Electric Generator SVI 170<br>1 Nest Ball SVI 255<br>1 Miriam SVI 251<br>1 Pal Pad SVI 182<br>1 Arven PAF 235<br>1 Iono PAF 237<br>1 Switch MEW 206<br>1 Pokégear 3.0 UNB 233<br>1 Boss's Orders PAL 265<br>1 Dusk Ball SSP 175 PH<br>1 Night Stretcher MEG 173<br>1 Hilda WHT 171<br>1 Technical Machine: Evolution PAR 178<br>1 Ultra Ball BRS 186<br>1 Counter Catcher PAR 264<br>1 Brock's Scouting JTG 179<br>1 Professor's Research CEL 24<br>1 Levincia JTG 150 PH<br>1 Vitality Band SVI 197<br>1 Surfer SSP 235<br>1 Energy Recycler DRI 164<br><br>Energia: 2<br>1 Luminous Energy PAL 191<br>9 Basic {L} Energy Energy 12`)
  },
  {
    player: "Cristian", week: 2, name: "S2 GLC — Fogo (Emboar)", archetype: "GLC Fogo",
    deckList: d(`Pokémon: 20<br>1 Pignite WHT 12<br>1 Larvesta SSP 24<br>1 Armarouge SSP 34<br>1 Moltres MEW 146<br>1 Oricorio SSP 26<br>1 Vulpix SSP 16<br>1 Pansear SCR 21<br>1 Tepig WHT 11<br>1 Emboar WHT 13<br>1 Growlithe SVI 31<br>1 Rapidash SCR 20<br>1 Volcarona BLK 16<br>1 Ponyta SCR 19<br>1 Sizzlipede SSP 27<br>1 Ninetales SSP 17<br>1 Victini SSP 21<br>1 Centiskorch SSP 28<br>1 Gouging Fire SSP 38<br>1 Simisear SSP 23<br>1 Charcadet SSP 33<br><br>Treinador: 28<br>1 Dusk Ball SSP 175<br>1 Counter Catcher PAR 160<br>1 Town Store OBF 196<br>1 Brock's Scouting JTG 146<br>1 Xerosic's Machinations SFA 64<br>1 Energy Search SVI 172<br>1 Night Stretcher SFA 61<br>1 Nest Ball SVI 181<br>1 Bravery Charm PAL 173<br>1 Boss's Orders PAL 172<br>1 Air Balloon BLK 79<br>1 Powerglass SFA 63<br>1 Amarys PRE 93 PH<br>1 Iono PAL 185<br>1 Arven SVI 166<br>1 Lucky Helmet TWM 158<br>1 Technical Machine: Evolution PAR 178<br>1 Defiance Band SVI 169<br>1 Buddy-Buddy Poffin PRE 101<br>1 Earthen Vessel PRE 106<br>1 Ciphermaniac's Codebreaking PRE 104<br>1 Crispin PRE 105<br>1 Bianca's Devotion TEF 142<br>1 Explorer's Guidance TEF 147<br>1 Vitality Band SVI 197<br>1 Switch SVI 194<br>1 Lisia's Appeal SSP 179<br>1 Rare Candy SVI 191<br><br>Energia: 2<br>1 Jet Energy PAL 190<br>11 Basic {R} Energy Energy 10`)
  },
  {
    player: "Alan", week: 2, name: "S2 GLC — Team Rocket Sombrio", archetype: "GLC Team Rocket",
    deckList: d(`Pokémon: 15<br>1 Team Rocket's Ekans DRI 112<br>1 Team Rocket's Zubat DRI 120 PH<br>1 Team Rocket's Nidoqueen DRI 116<br>1 Team Rocket's Weezing DRI 126<br>1 Team Rocket's Golbat DRI 121 PH<br>1 Team Rocket's Nidoran♀ DRI 114<br>1 Team Rocket's Muk DRI 124<br>1 Team Rocket's Grimer DRI 123<br>1 Team Rocket's Nidorino DRI 118<br>1 Team Rocket's Sneasel DRI 128<br>1 Team Rocket's Nidorina DRI 115 PH<br>1 Team Rocket's Arbok DRI 113 PH<br>1 Team Rocket's Nidoran♂ DRI 117<br>1 Team Rocket's Murkrow DRI 127<br>1 Team Rocket's Koffing DRI 125<br><br>Treinador: 32<br>1 Counter Catcher PAR 160<br>1 Youngster SVI 198<br>1 Team Rocket's Bother-Bot DRI 172<br>1 Surfer SSP 187<br>1 Brock's Scouting JTG 146<br>1 Team Rocket's Archer DRI 170<br>1 Team Rocket's Petrel DRI 176<br>1 Team Rocket's Transceiver DRI 178 PH<br>1 Energy Switch SVI 173<br>1 Energy Retrieval SVI 171<br>1 Team Rocket's Giovanni DRI 174<br>1 Night Stretcher SFA 61<br>1 Bravery Charm PAL 173<br>1 Team Rocket's Factory DRI 173<br>1 Boss's Orders PAL 172<br>1 Team Rocket's Proton DRI 177 PH<br>1 Lana's Aid TWM 155<br>1 Iono PAL 185<br>1 Sacred Ash DRI 168 PH<br>1 Arven SVI 166<br>1 Superior Energy Retrieval PAL 189<br>1 Super Rod PAL 188<br>1 Defiance Band SVI 169<br>1 Energy Recycler DRI 164 PH<br>1 Team Rocket's Ariana DRI 171 PH<br>1 Crispin PRE 105<br>1 Judge DRI 167<br>1 Team Rocket's Great Ball DRI 175<br>1 Ultra Ball SVI 196<br>1 Switch SVI 194<br>1 Professor's Research PRE 124<br>1 Earthen Vessel PAR 163<br><br>Energia: 2<br>12 Basic {D} Energy SVE 15<br>1 Team Rocket's Energy DRI 182`)
  },
  {
    player: "Nakaima", week: 2, name: "S2 GLC — Sombrio (Houndoom)", archetype: "GLC Sombrio",
    deckList: d(`Pokémon: 20<br>1 Zorua SFA 75<br>1 Houndour OBF 132 PH<br>1 Houndoom OBF 133<br>1 Gengar PAF 57<br>1 Haunter PAF 56<br>1 Thievul MEG 90<br>1 Gastly TEF 177<br>1 Nickit MEG 89<br>1 Team Rocket's Ekans DRI 112<br>1 Yveltal MEG 88<br>1 Toxel PFL 67<br>1 Sneasel MEP 20<br>1 Mabosstiff PAL 143 PH<br>1 Weavile MEP 21<br>1 Eternatus PFL 69 PH<br>1 Maschiff SVI 136 PH<br>1 Zoroark WHT 62 PH<br>1 Toxtricity PFL 103<br>1 Darkrai OBF 136<br>1 Team Rocket's Arbok DRI 113<br><br>Treinador: 27<br>1 Rika PAR 172<br>1 Technical Machine: Devolution PAR 177<br>1 Team Rocket's Archer DRI 170<br>1 Deduction Kit SSP 171<br>1 Team Rocket's Great Ball DRI 175<br>1 Grusha PAL 184<br>1 Pal Pad SVI 182<br>1 Binding Mochi SFA 55<br>1 Lisia's Appeal SSP 179<br>1 Kofu SCR 138<br>1 Grimsley's Move PFL 90<br>1 Iono PAF 80<br>1 Hassel TWM 151 PH<br>1 Miriam SVI 251<br>1 Surfer SSP 187<br>1 Night Stretcher SFA 61<br>1 Luxurious Cape PAR 166<br>1 Brock's Scouting JTG 179<br>1 Rigid Band MEW 165<br>1 N's Plan BLK 83 PH<br>1 Lillie's Determination MEG 184<br>1 Dawn PFL 87<br>1 Ruffian JTG 157<br>1 Boss's Orders PAL 172<br>1 Risky Ruins MEG 127 PH<br>1 Daisy's Help MEW 158<br>1 Nest Ball PAF 84 PH<br><br>Energia: 7<br>2 Basic {D} Energy MEE 7<br>2 Basic {D} Energy SVE 23<br>1 Jet Energy PAL 190 PH<br>2 Basic {D} Energy Energy 42<br>2 Basic {D} Energy SVE 15<br>2 Basic {D} Energy Energy 51<br>2 Basic {D} Energy Energy 7`)
  },
  {
    player: "Rodrigo", week: 2, name: "S2 GLC — Elétrico (Alolan Golem)", archetype: "GLC Elétrico",
    deckList: d(`Pokémon: 20<br>1 Alolan Geodude JTG 44<br>1 Team Rocket's Flaaffy DRI 73<br>1 Eelektrik BLK 114<br>1 Tynamo BLK 113<br>1 Morpeko TWM 72<br>1 Emolga BLK 112<br>1 Plusle PAR 193<br>1 Zebstrika WHT 115<br>1 Minun PAR 194<br>1 Bellibolt OBF 77 PH<br>1 Alolan Graveler JTG 45<br>1 Pawmo SVI 75<br>1 Pawmot PAL 76<br>1 Pawmi SVI 73<br>1 Blitzle SSP 62 PH<br>1 Team Rocket's Mareep DRI 72 PH<br>1 Tadbulb PAL 77<br>1 Team Rocket's Ampharos DRI 74 PH<br>1 Alolan Golem JTG 46<br>1 Tapu Koko SSP 65<br><br>Treinador: 31<br>1 Miriam SVI 251<br>1 Jacq SVI 250<br>1 Earthen Vessel SFA 96<br>1 Geeta OBF 218<br>1 Clemont's Quick Wit SSP 229<br>1 Brock's Scouting JTG 179<br>1 Boss's Orders PAL 265<br>1 Electric Generator SVI 170<br>1 Lt. Surge's Bargain MEG 170<br>1 Arven PAF 235<br>1 Super Rod PAL 276<br>1 Night Stretcher MEG 173<br>1 Iono PAL 269<br>1 Rare Candy MEG 175<br>1 Lillie's Determination MEG 169<br>1 Dusk Ball SSP 175<br>1 Ultra Ball BRS 186<br>1 Clavell PAL 249<br>1 Dawn PFL 129<br>1 Air Balloon SSH 213<br>1 Technical Machine: Evolution PAR 178<br>1 Redeemable Ticket JTG 156<br>1 Energy Switch SIT 212<br>1 Letter of Encouragement OBF 189 PH<br>1 Buddy-Buddy Poffin TWM 223<br>1 Colress's Tenacity SFA 87<br>1 Counter Catcher PAR 264<br>1 Switch MEW 206<br>1 Hilda WHT 164<br>1 Levincia DRI 244<br>1 Nest Ball SVI 255<br><br>Energia: 3<br>1 Team Rocket's Energy DRI 182<br>1 Reversal Energy PAL 192<br>7 Basic {L} Energy SVE 4 PH`)
  },
  {
    player: "Erick", week: 2, name: "S2 GLC — Psíquico (Togekiss / Dusknoir)", archetype: "GLC Psíquico",
    deckList: d(`Pokémon: 12<br>1 Togekiss SSP 72<br>1 Munkidori TWM 95<br>1 Togepi OBF 83<br>1 Duskull SFA 18<br>1 Elgyem TEF 73 PH<br>1 Uxie SSP 78<br>1 Dusclops SFA 19<br>1 Beheeyem TEF 74<br>1 Togetic SSP 71 PH<br>1 Dedenne SVI 94<br>1 Dusknoir SFA 20<br>1 Cresselia PFL 39<br><br>Treinador: 33<br>1 Dusk Ball SSP 175<br>1 Counter Catcher PAR 160<br>1 Ryme OBF 194<br>1 Switch CRZ 144<br>1 Surfer SSP 187<br>1 Dawn PFL 87<br>1 Rocky Helmet VIV 159<br>1 Brock's Scouting JTG 146<br>1 Rika PAR 258<br>1 Jacq SVI 175<br>1 Night Stretcher SFA 61<br>1 Kofu SCR 138<br>1 Repel MEG 126<br>1 Clavell PAL 177<br>1 Bravery Charm PAL 173<br>1 Air Balloon BLK 79<br>1 Ruffian JTG 157<br>1 Nest Ball SVI 181<br>1 Iono PAL 185<br>1 Arven SVI 166<br>1 Great Ball PAL 183<br>1 Hilda WHT 84<br>1 Technical Machine: Evolution PAR 178<br>1 Colress's Tenacity SFA 57<br>1 Energy Retrieval CRZ 127<br>1 Wondrous Patch PFL 94<br>1 Crispin SCR 133<br>1 Buddy-Buddy Poffin TEF 144<br>1 Energy Search CRZ 128<br>1 Lillie's Determination MEG 119<br>1 Lisia's Appeal SSP 179<br>1 Boss's Orders MEG 114<br>1 Earthen Vessel PAR 163<br><br>Energia: 4<br>1 Jet Energy PAL 190<br>11 Basic {P} Energy Energy 13<br>2 Basic {D} Energy MEE 7<br>1 Spiky Energy JTG 159`)
  },
  // ── SEMANA 3 — Padrão ────────────────────────────────────────────────────
  {
    player: "Luiz", week: 3, name: "S3 — Mega Charizard X ex / Oricorio", archetype: "Mega Charizard X ex",
    deckList: d(`Pokémon: 11<br>1 Charizard ex PAF 234<br>1 Victini SSP 21<br>1 Charizard ex OBF 223<br>3 Charmander PAF 7<br>2 Oricorio ex PFL 18<br>1 Charmeleon PFL 12<br>1 Chi-Yu PAR 29<br>1 Moltres MEW 146<br>2 Mega Charizard X ex PFL 125<br>2 Charmeleon PFL 12<br>1 Charmander PFL 11<br><br>Treinador: 21<br>2 Battle Cage PFL 116<br>1 Earthen Vessel SFA 96<br>1 Boss's Orders PAL 265<br>2 Lillie's Determination MEG 119<br>2 Arven PAF 235<br>3 Iono PAF 237<br>1 Lillie's Determination MEG 169<br>1 Night Stretcher SSP 251<br>1 Professor Turo's Scenario PAR 257<br>2 Nest Ball SUM 158<br>1 Boss's Orders PAL 248<br>3 Ultra Ball BRS 186<br>1 Superior Energy Retrieval PAL 189<br>1 Buddy-Buddy Poffin MEG 167<br>1 Artazon OBF 229<br>2 Professor's Research SVI 240<br>1 Prime Catcher TEF 157<br>1 Buddy-Buddy Poffin TWM 223<br>2 Rare Candy GRI 165<br>1 Counter Catcher PAR 264<br>2 Technical Machine: Evolution PAR 178<br><br>Energia: 2<br>10 Basic {R} Energy SVE 18<br>2 Jet Energy PAL 190`)
  },
  {
    player: "Erick", week: 3, name: "S3 — Espathra ex / Mew ex", archetype: "Espathra ex",
    deckList: d(`Pokémon: 6<br>1 Hoopa ex PAR 226<br>2 Munkidori SFA 72<br>2 Espathra ex PAF 6<br>3 Flittle SCR 68<br>1 Espathra ex PAF 214<br>1 Mew ex PAF 232<br><br>Treinador: 14<br>4 Dusk Ball SSP 175<br>2 Buddy-Buddy Poffin TWM 223<br>3 Lillie's Determination MEG 184<br>4 Crushing Hammer UPR 166<br>2 Buddy-Buddy Poffin MEG 167<br>4 Nest Ball SVI 255<br>1 Hero's Cape TEF 152<br>4 Pokémon Catcher SVI 187<br>2 Arven PAF 235<br>1 Calamitous Snowy Mountain PAL 174<br>1 Handheld Fan TWM 150<br>4 Night Stretcher SSP 251<br>2 Crispin PRE 171<br>4 Energy Search CRZ 128<br><br>Energia: 3<br>4 Luminous Energy PAL 191<br>4 Basic {D} Energy Energy 15<br>4 Basic {P} Energy Energy 13`)
  },
  {
    player: "Nakaima", week: 3, name: "S3 — Hydreigon ex / Dark", archetype: "Hydreigon ex",
    deckList: d(`Pokémon: 15<br>1 Carvanha PFL 60<br>1 Darkrai OBF 136<br>2 Hydreigon ex SSP 119<br>1 Mightyena TEF 106<br>1 Zorua SFA 75<br>2 Deino WHT 65<br>1 Zweilous SSP 118<br>1 Zweilous PAL 139<br>1 Maschiff SVI 136<br>1 Yveltal MEG 88<br>1 Mega Sharpedo ex PFL 113<br>1 Mabosstiff PAL 143<br>1 N's Zorua JTG 97<br>1 Zoroark WHT 62<br>1 Zoroark SFA 32<br><br>Treinador: 29<br>1 Rika PAR 172<br>1 Technical Machine: Devolution PAR 177<br>1 Grusha PAL 184<br>1 Lisia's Appeal SSP 179<br>1 Deduction Kit SSP 171<br>1 Janine's Secret Art PRE 112<br>1 Pal Pad SVI 182<br>1 Binding Mochi SFA 55<br>1 Super Rod PAL 188<br>1 Switch PFL 123<br>1 Punk Helmet PFL 92<br>1 Kofu SCR 138<br>1 Grimsley's Move PFL 120<br>1 Iono PAF 237<br>1 Hassel TWM 205<br>1 Miriam SVI 251<br>1 Surfer SSP 187<br>1 Night Stretcher SFA 61<br>1 Brock's Scouting JTG 179<br>1 Max Rod PRE 116<br>1 N's Plan BLK 83<br>2 Lillie's Determination MEG 184<br>1 Dawn PFL 129<br>1 Daisy's Help MEW 158<br>1 Risky Ruins MEG 127<br>1 Boss's Orders PAL 265<br>1 Ruffian JTG 157<br>1 Boss's Orders RCL 200<br>1 Nest Ball PAF 84<br><br>Energia: 7<br>1 Basic {D} Energy MEE 7<br>2 Basic {D} Energy SVE 23<br>2 Basic {D} Energy Energy 42<br>2 Basic {D} Energy SVE 15<br>2 Basic {D} Energy Energy 51<br>2 Boomerang Energy TWM 166<br>2 Basic {D} Energy Energy 7`)
  },
  {
    player: "Moises", week: 3, name: "S3 — Ceruledge ex / Charizard ex", archetype: "Ceruledge ex",
    deckList: d(`Pokémon: 11<br>1 Ceruledge ex PRE 147<br>2 Charmander MEW 4<br>1 Ceruledge ex SSP 36<br>2 Charmeleon PAF 8<br>2 Mega Charizard X ex PFL 13<br>1 Chi-Yu PAR 29<br>3 Charcadet PAR 26<br>1 Armarouge SVI 41<br>2 Oricorio ex PFL 18<br>2 Cinderace MEG 28<br>1 Charizard ex OBF 125<br><br>Treinador: 19<br>2 Buddy-Buddy Poffin TWM 223<br>4 Lillie's Determination MEG 184<br>2 Rare Candy GRI 165<br>1 Secret Box TWM 163<br>1 Super Rod PAL 276<br>2 Earthen Vessel SFA 96<br>1 Dawn PFL 129<br>1 Technical Machine: Evolution PAR 178<br>2 Arven PAF 235<br>1 Iono PAF 237<br>1 Switch MEW 206<br>2 Boss's Orders PAL 265<br>2 Night Stretcher SSP 251<br>3 Nest Ball SUM 158<br>1 Hilda WHT 171<br>2 Ultra Ball BRS 186<br>1 Firebreather PFL 119<br>1 Blowtorch PFL 117<br>1 Battle Cage PFL 116<br><br>Energia: 2<br>10 Basic {R} Energy SVE 10<br>1 Jet Energy PAL 190`)
  },
  {
    player: "Rodrigo", week: 3, name: "S3 — Charizard ex / Mega Kangaskhan ex", archetype: "Charizard ex",
    deckList: d(`Pokémon: 9<br>1 Mega Kangaskhan ex MEG 182<br>1 Munkidori SFA 72<br>3 Charmeleon PAF 110<br>1 Fezandipiti ex SFA 92<br>4 Charmander PFL 11<br>1 Mega Kangaskhan ex MEG 164<br>3 Charizard ex PAF 234<br>1 Shaymin DRI 185<br>2 Mimikyu PR-SV 75<br><br>Treinador: 16<br>1 Buddy-Buddy Poffin TWM 223<br>1 Tera Orb SSP 189<br>3 Lillie's Determination MEG 169<br>2 Super Rod PAL 276<br>1 Artazon OBF 229<br>4 Nest Ball SVI 255<br>1 Maximum Belt TEF 154<br>3 Arven PAF 235<br>2 Boss's Orders PAL 265<br>4 Rare Candy MEG 175<br>1 Technical Machine: Evolution PAR 178<br>4 Ultra Ball BRS 186<br>1 Defiance Band SVI 169<br>1 Counter Catcher PAR 264<br>1 Air Balloon SSH 213<br>1 Battle Cage PFL 116<br><br>Energia: 2<br>11 Basic {R} Energy SVE 2<br>1 Basic {D} Energy SVE 7`)
  },
  {
    player: "Cristian", week: 3, name: "S3 — Flygon / Hydreigon ex", archetype: "Flygon",
    deckList: d(`Pokémon: 10<br>4 Trapinch PFL 51<br>3 Hydreigon ex SSP 119<br>1 Zweilous SSP 118<br>4 Deino SSP 117<br>2 Zweilous SSP 118 PH<br>3 Flygon PFL 53<br>1 Flygon PFL 101<br>3 Vibrava PFL 52<br>1 Hydreigon ex SSP 240<br>1 Vibrava PFL 52 PH<br><br>Treinador: 16<br>2 Buddy-Buddy Poffin PRE 101<br>2 Crispin PRE 105<br>3 Lillie's Determination MEG 119<br>1 Professor Turo's Scenario PAR 257<br>1 Professor Turo's Scenario PRE 121 PH<br>1 Ultra Ball MEG 131<br>1 Super Rod PAL 188<br>1 Technical Machine: Evolution PAR 178<br>1 Sparkling Crystal PRE 129<br>2 Penny SVI 183<br>1 Crispin PRE 171<br>3 Rare Candy GRI 165<br>3 Dawn PFL 87<br>1 Professor Turo's Scenario PAR 240<br>3 Arven SVI 166<br>1 Beach Court SVI 167<br><br>Energia: 3<br>2 Basic {M} Energy Energy 16<br>6 Basic {D} Energy Energy 15<br>2 Basic {P} Energy Energy 13`)
  },
  {
    player: "Alan", week: 3, name: "S3 — Gardevoir ex", archetype: "Gardevoir ex",
    deckList: d(`Pokémon: 11<br>1 Jellicent ex WHT 45<br>1 Drifloon SVI 89<br>1 Scream Tail PAR 86<br>3 Munkidori TWM 95<br>2 Kirlia MEG 59<br>1 Mew ex MEW 151<br>2 Frillish WHT 44<br>1 Mega Diancie ex PFL 41<br>1 Lillie's Clefairy ex JTG 56<br>2 Gardevoir ex SVI 86<br>3 Ralts MEG 58<br><br>Treinador: 17<br>1 Counter Catcher PAR 160<br>1 Secret Box TWM 163<br>2 Night Stretcher SFA 61<br>1 Mystery Garden MEG 122<br>2 Nest Ball SVI 181<br>2 Rare Candy MEG 125<br>1 Dawn PFL 87<br>1 Artazon PAL 171<br>1 Arven OBF 186<br>2 Bravery Charm PAL 173<br>4 Iono PAL 185<br>1 Professor Turo's Scenario PAR 171<br>1 Technical Machine: Evolution PAR 178<br>1 Super Rod PAL 188<br>4 Lillie's Determination MEG 119<br>4 Ultra Ball MEG 131<br>3 Earthen Vessel PAR 163<br><br>Energia: 2<br>7 Basic {P} Energy MEE 5<br>3 Basic {D} Energy MEE 7`)
  },
  // ── SEMANA 4 — Duplas ────────────────────────────────────────────────────
  {
    player: "Erick", week: 4, name: "S4 — Glimmora ex / Cradily", archetype: "Glimmora ex",
    deckList: d(`Pokémon: 6<br>1 Glimmora ex OBF 123<br>2 Dwebble DRI 11<br>4 Glimmet PAL 124<br>2 Crustle DRI 12<br>4 Glimmora PAL 126<br>1 Cornerstone Mask Ogerpon ex PRE 58<br><br>Treinador: 16<br>4 Buddy-Buddy Poffin PRE 101<br>4 Switch SVI 194<br>1 Xerosic's Machinations SFA 64<br>2 Crushing Hammer SVI 168<br>2 Earthen Vessel PAR 163<br>4 Lillie's Determination MEG 119<br>1 Counter Catcher PAR 160<br>2 Air Balloon BLK 79<br>4 Fighting Gong MEG 116<br>2 Night Stretcher SFA 61<br>1 Colress's Tenacity SFA 57<br>1 Super Rod PAL 188<br>2 Perilous Jungle TEF 156<br>1 Neutralization Zone SFA 60<br>2 Boss's Orders PAL 172<br>2 Arven SVI 166<br><br>Energia: 3<br>7 Basic {F} Energy SVE 14<br>2 Basic {G} Energy Energy 1<br>2 Luminous Energy PAL 191`)
  },
  {
    player: "Erick", week: 4, name: "S4 — Miraidon ex / Iron Thorns ex", archetype: "Miraidon ex",
    deckList: d(`Pokémon: 4<br>1 Miraidon ex SVI 81<br>2 Iron Hands ex PAR 70<br>2 Miraidon TEF 121<br>3 Iron Thorns ex TWM 77<br><br>Treinador: 20<br>2 Energy Retrieval CRZ 127<br>4 Crushing Hammer SVI 168<br>2 Earthen Vessel PAR 163<br>3 Electric Generator SVI 170<br>2 Techno Radar PRE 130<br>3 Crispin SCR 133<br>4 Lillie's Determination MEG 119<br>2 Future Booster Energy Capsule TEF 149<br>2 Boss's Orders MEG 114<br>1 Energy Switch MEG 115<br>1 Switch MEG 130<br>1 Ruffian JTG 157<br>1 Town Store OBF 196<br>1 Heavy Baton TEF 151<br>1 Energy Search CRZ 128<br>1 Levincia JTG 150<br>3 Nest Ball SVI 181<br>1 Scramble Switch SSP 186<br>1 Bravery Charm PAL 173<br>4 Arven SVI 166<br><br>Energia: 2<br>2 Basic {P} Energy Energy 13<br>10 Basic {L} Energy Energy 12`)
  },
  {
    player: "Rodrigo", week: 4, name: "S4 — Feraligatr / Mega Sharpedo ex", archetype: "Feraligatr",
    deckList: d(`Pokémon: 6<br>3 Croconaw TEF 40<br>3 Totodile TEF 39<br>2 Carvanha PFL 60<br>2 Mega Sharpedo ex PFL 127<br>2 Relicanth TEF 173<br>3 Feraligatr TEF 41<br><br>Treinador: 17<br>3 Lana's Aid TWM 207<br>1 Buddy-Buddy Poffin TWM 223<br>1 Crispin SCR 164<br>2 Luxurious Cape PAR 166<br>1 Precious Trolley SSP 185<br>4 Lillie's Determination MEG 169<br>1 Artazon OBF 229<br>1 Earthen Vessel SFA 96<br>2 Dawn PFL 129<br>4 Arven PAF 235<br>4 Pokégear 3.0 UNB 233<br>1 Night Stretcher SSP 251<br>2 Boss's Orders PAL 248<br>1 Beach Court SVI 167<br>1 Iono PAL 269<br>2 Technical Machine: Evolution PAR 178<br>3 Counter Catcher PAR 264<br><br>Energia: 3<br>1 Luminous Energy TWM 226<br>4 Basic {D} Energy SVE 7<br>6 Basic {W} Energy SVE 3`)
  },
  {
    player: "Luiz", week: 4, name: "S4 — Ethan's Typhlosion / Ho-Oh ex", archetype: "Ethan's Typhlosion",
    deckList: d(`Pokémon: 12<br>3 Ethan's Cyndaquil DRI 32<br>1 Ethan's Quilava DRI 33<br>1 Ethan's Ho-Oh ex DRI 239<br>1 Victini SSP 21<br>1 Ethan's Magcargo DRI 36<br>1 Moltres MEW 146<br>1 Ethan's Slugma DRI 35<br>1 Ethan's Cyndaquil DRI 32<br>3 Ethan's Quilava DRI 33<br>1 Victini SSP 21<br>4 Ethan's Typhlosion DRI 190<br>1 Ethan's Ho-Oh ex DRI 209<br><br>Treinador: 23<br>1 Night Stretcher SSP 251<br>1 Air Balloon MEG 166<br>2 Arven PAF 235<br>1 Boss's Orders PAL 248<br>1 Lillie's Determination MEG 169<br>1 Lillie's Determination MEG 119<br>3 Ultra Ball BRS 186<br>2 Super Rod PAL 276<br>2 Counter Catcher PAR 264<br>1 Earthen Vessel SFA 96<br>1 Secret Box TWM 163<br>1 Technical Machine: Evolution PAR 178<br>1 Redeemable Ticket JTG 156<br>1 Buddy-Buddy Poffin MEG 167<br>2 Artazon OBF 229<br>1 Air Balloon BLK 79<br>2 Brave Bangle WHT 80<br>1 Ethan's Adventure DRI 221<br>1 Gravity Mountain SSP 250<br>1 Rare Candy GRI 165<br>3 Buddy-Buddy Poffin TWM 223<br>3 Ethan's Adventure DRI 236<br>1 Boss's Orders PAL 265<br><br>Energia: 2<br>6 Basic {R} Energy OBF 230<br>1 Basic {R} Energy SVE 10`)
  },
  {
    player: "Nakaima", week: 4, name: "S4 — Mega Lucario ex / Koraidon ex (Luta)", archetype: "Mega Lucario ex",
    deckList: d(`Pokémon: 14<br>1 Riolu MEP 10<br>1 Riolu MEG 76<br>1 Hariyama MEG 73<br>1 Makuhita MEG 72<br>1 Mienfoo SCR 83<br>1 Conkeldurr BLK 49<br>1 Gurdurr BLK 48<br>3 Mega Lucario ex MEG 179<br>1 Riolu MEG 76<br>1 Makuhita MEG 72<br>1 Hariyama MEG 73<br>1 Timburr BLK 47<br>1 Koraidon ex SVI 125<br>1 Mienshao PAR 97<br><br>Treinador: 25<br>1 Hassel TWM 205<br>3 Lillie's Determination MEG 184<br>1 Air Balloon SSH 156<br>1 Tool Scrapper WHT 85<br>2 Fighting Gong MEG 168<br>1 Rock Chestplate SVI 192<br>2 Dawn PFL 129<br>1 Miriam SVI 251<br>1 Super Rod PAL 188<br>2 Night Stretcher SFA 61<br>1 Switch PFL 123<br>1 Arven SVI 249<br>2 Nest Ball SVI 181<br>1 Switch CES 147<br>1 Fennel BLK 162<br>1 Boss's Orders PAL 265<br>3 Premium Power Pro MEG 174<br>1 Gravity Mountain SSP 250<br>1 Rare Candy MEG 175<br>1 Iono PAL 269<br>1 Boss's Orders RCL 200<br>1 Poppy OBF 220<br>1 Unfair Stamp TWM 165<br>1 Buddy-Buddy Poffin TEF 144<br>1 Bravery Charm PAL 173<br><br>Energia: 2<br>10 Basic {F} Energy MEE 6<br>1 Ignition Energy WHT 86`)
  },
  {
    player: "Alan", week: 4, name: "S4 — Gholdengo ex / Genesect ex", archetype: "Gholdengo ex",
    deckList: d(`Pokémon: 6<br>3 Genesect ex BLK 67<br>2 Lunatone MEG 74<br>1 Fezandipiti ex SFA 38<br>2 Solrock MEG 75<br>4 Gimmighoul PAR 87<br>4 Gholdengo ex PAR 139<br><br>Treinador: 17<br>2 Fighting Gong MEG 116<br>1 Precious Trolley SSP 185<br>3 Nest Ball PAF 84<br>2 Energy Retrieval SVI 171<br>1 Energy Recycler DRI 164<br>2 Night Stretcher SFA 61<br>1 Pal Pad SVI 182<br>1 Artazon PAL 171<br>2 Air Balloon BLK 79<br>1 Sacred Ash DRI 168<br>1 Miriam SVI 251<br>1 Professor Turo's Scenario PAR 171<br>3 Superior Energy Retrieval PAL 189<br>1 Super Rod PAL 188<br>2 Levincia JTG 150<br>2 Ciphermaniac's Codebreaking PRE 104<br>2 Earthen Vessel PAR 163<br><br>Energia: 3<br>3 Basic {M} Energy Energy 16<br>8 Basic {F} Energy Energy 14<br>5 Basic {L} Energy Energy 12`)
  },
  {
    player: "Alan", week: 4, name: "S4 — Mega Kangaskhan ex / Grookey", archetype: "Mega Kangaskhan ex",
    deckList: d(`Pokémon: 7<br>1 Mega Kangaskhan ex MEG 182<br>4 Thwackey TWM 15<br>2 Teal Mask Ogerpon ex TWM 25<br>2 Goldeen PRE 20<br>1 Mega Kangaskhan ex MEG 104<br>4 Grookey TWM 14<br>2 Seaking PRE 21<br><br>Treinador: 17<br>1 Counter Catcher PAR 160<br>4 Bug Catching Set TWM 143<br>3 Festival Grounds TWM 149<br>2 Kieran PRE 113<br>1 Maximum Belt TEF 154<br>2 Boss's Orders PAL 172<br>1 Air Balloon BLK 79<br>1 Lana's Aid TWM 155<br>3 Iono PAL 185<br>4 Arven SVI 166<br>1 Festival Grounds PRE 108<br>2 Super Rod PAL 188<br>2 Professor's Research JTG 155<br>2 Buddy-Buddy Poffin PRE 101<br>2 Buddy-Buddy Poffin TEF 144<br>2 Brave Bangle WHT 80<br>1 Ultra Ball SVI 196<br><br>Energia: 1<br>10 Basic {G} Energy SVE 1`)
  },
  // ── SEMANA 5 — Padrão ────────────────────────────────────────────────────
  {
    player: "Luiz", week: 5, name: "S5 — Ethan's Typhlosion / Ho-Oh ex", archetype: "Ethan's Typhlosion",
    deckList: d(`Pokémon: 12<br>1 Victini SSP 21<br>3 Ethan's Cyndaquil DRI 32<br>1 Ethan's Quilava DRI 33<br>1 Ethan's Slugma DRI 35<br>1 Ethan's Magcargo DRI 36<br>4 Ethan's Typhlosion DRI 190<br>1 Ethan's Ho-Oh ex DRI 209<br>1 Ethan's Ho-Oh ex DRI 239<br>3 Ethan's Quilava DRI 33<br>1 Ethan's Cyndaquil DRI 32<br>1 Victini SSP 21<br>1 Moltres MEW 146<br><br>Treinador: 23<br>2 Artazon OBF 229<br>1 Earthen Vessel SFA 96<br>2 Super Rod PAL 276<br>2 Counter Catcher PAR 264<br>2 Brave Bangle WHT 80<br>1 Lillie's Determination MEG 119<br>1 Lillie's Determination MEG 169<br>1 Gravity Mountain SSP 250<br>1 Night Stretcher SSP 251<br>1 Technical Machine: Evolution PAR 178<br>1 Air Balloon MEG 166<br>1 Buddy-Buddy Poffin MEG 167<br>1 Air Balloon BLK 79<br>1 Boss's Orders PAL 248<br>1 Rare Candy GRI 165<br>3 Ethan's Adventure DRI 236<br>1 Secret Box TWM 163<br>3 Ultra Ball BRS 186<br>1 Boss's Orders PAL 265<br>2 Arven PAF 235<br>1 Ethan's Adventure DRI 221<br>1 Redeemable Ticket JTG 156<br>3 Buddy-Buddy Poffin TWM 223<br><br>Energia: 2<br>1 Basic {R} Energy SVE 10<br>6 Basic {R} Energy OBF 230`)
  },
  {
    player: "Luiz", week: 5, name: "S5 — Alakazam ex / Dunsparce", archetype: "Alakazam",
    deckList: d(`Pokémon: 16<br>4 Abra MEG 54<br>1 Kadabra MEG 55<br>2 Kadabra MEG 55<br>1 Alakazam MEP 9<br>2 Alakazam MEG 56<br>1 Dunsparce JTG 120<br>2 Dunsparce PRE 79<br>1 Dunsparce TEF 128<br>1 Dudunsparce PRE 80<br>3 Dudunsparce PRE 80<br>1 Psyduck MEP 7<br>1 Togekiss SSP 72<br>1 Togepi OBF 83<br>1 Togetic OBF 84<br>1 Fan Rotom PRE 85<br>1 Alakazam MEG 56<br><br>Treinador: 16<br>2 Battle Cage PFL 116<br>2 Battle Cage PFL 85<br>2 Boss's Orders PAL 248<br>1 Boss's Orders PAL 265<br>4 Poké Pad ASC 198<br>1 Buddy-Buddy Poffin MEG 167<br>2 Buddy-Buddy Poffin TWM 223<br>2 Rare Candy MEG 175<br>2 Enhanced Hammer TWM 148<br>1 Sacred Ash DRI 168<br>2 Dawn PFL 129<br>1 Dawn PFL 87<br>1 Hilda WHT 171<br>3 Hilda WHT 84<br>2 Night Stretcher SFA 61<br>3 Wondrous Patch PFL 94<br><br>Energia: 2<br>4 Basic {P} Energy Energy 49<br>1 Enriching Energy SSP 191`)
  },
  {
    player: "Rodrigo", week: 5, name: "S5 — Gigalith / Rock (Pedra)", archetype: "Gigalith",
    deckList: d(`Pokémon: 5<br>3 Dwebble BLK 129<br>3 Roggenrola WHT 127<br>3 Gigalith WHT 129<br>3 Boldore WHT 128<br>3 Crustle BLK 130<br><br>Treinador: 22<br>3 Ultra Ball SVI 196<br>1 Earthen Vessel PRE 106<br>2 Rare Candy PAF 89<br>1 Jacq SVI 175<br>2 Explorer's Guidance TEF 147<br>3 Buddy-Buddy Poffin TEF 144<br>3 Luxurious Cape PAR 166<br>1 Grand Tree SCR 136<br>1 Kofu SCR 138<br>2 Iono PAL 185<br>1 Artazon PAF 76<br>1 Great Ball PAL 183<br>1 Air Balloon SSH 213<br>1 Colress's Tenacity SFA 57<br>1 Technical Machine: Turbo Energize PAR 179<br>1 Super Rod PAL 188<br>1 Big Air Balloon MEW 155<br>1 Town Store OBF 196<br>1 Professor's Research PRE 123<br>2 Nest Ball PAF 84<br>2 Surfer SSP 187<br>2 Switch MEW 206<br><br>Energia: 2<br>10 Basic {F} Energy SVE 14<br>1 Reversal Energy PAL 192`)
  },
  {
    player: "Erick", week: 5, name: "S5 — Glimmora ex / Cradily", archetype: "Glimmora ex",
    deckList: d(`Pokémon: 6<br>2 Dwebble DRI 11<br>4 Glimmet PAL 124<br>2 Crustle DRI 12<br>4 Glimmora PAL 126<br>4 Cradily SCR 6<br>4 Lileep SCR 145<br><br>Treinador: 19<br>1 Rare Candy MEG 175<br>4 Arven PAF 235<br>3 Lillie's Determination MEG 184<br>1 Antique Root Fossil SCR 130<br>1 Atticus PRE 133<br>1 Atticus PRE 134<br>3 Antique Root Fossil SCR 130<br>1 Forest of Vitality MEG 117<br>1 Perilous Jungle TEF 156<br>2 Pokémon Catcher SVI 187<br>3 Buddy-Buddy Poffin MEG 167<br>1 Surfer SSP 235<br>1 Surfer ASC 200<br>1 Neutralization Zone SFA 60<br>1 Dawn PFL 129<br>1 Dawn PFL 118<br>1 Surfer SSP 187<br>1 Hilda WHT 171<br>1 Hilda WHT 164<br><br>Energia: 2<br>6 Basic {G} Energy SVE 9<br>5 Basic {F} Energy GRI 169`)
  },
  {
    player: "Cristian", week: 5, name: "S5 — Galarian Obstagoon / Froslass", archetype: "Galarian Obstagoon",
    deckList: d(`Pokémon: 8<br>2 Galarian Obstagoon ASC 132<br>3 Galarian Zigzagoon ASC 130<br>2 Munkidori SFA 72<br>1 Fezandipiti ex ASC 288<br>3 Galarian Linoone ASC 131<br>2 Froslass TWM 174<br>3 Snorunt PAR 188<br>1 Galarian Obstagoon ASC 245<br><br>Treinador: 19<br>2 Buddy-Buddy Poffin TWM 223<br>1 Punk Helmet PFL 92<br>2 Rare Candy GRI 165<br>1 Rare Candy SVI 256<br>1 Switch PFL 123<br>1 Punk Helmet PFL 121<br>2 Risky Ruins MEG 127<br>3 Poké Pad ASC 198<br>3 Arven PAF 235<br>1 Iono PAF 237<br>1 Boss's Orders PAL 265<br>3 Night Stretcher SSP 251<br>3 Crispin PRE 171<br>1 Nest Ball SUM 158<br>2 Boss's Orders ASC 256<br>1 Colress's Tenacity SFA 87<br>4 Lillie's Determination MEG 119<br>1 Air Balloon ASC 181<br>1 Neutralization Zone SFA 60<br><br>Energia: 2<br>4 Basic {P} Energy MEE 5<br>5 Basic {D} Energy MEE 7`)
  },
  {
    player: "Nakaima", week: 5, name: "S5 — Mega Lucario ex / Mega Hawlucha ex", archetype: "Mega Lucario ex",
    deckList: d(`Pokémon: 14<br>1 Makuhita MEG 72<br>3 Mega Lucario ex MEG 179<br>1 Timburr BLK 47<br>1 Conkeldurr BLK 49<br>1 Riolu MEP 10<br>1 Gurdurr BLK 48<br>1 Mega Hawlucha ex ASC 283<br>1 Riolu MEG 76<br>1 Riolu MEG 76<br>1 Makuhita MEG 72<br>1 Mienfoo SCR 83<br>1 Hariyama MEG 73<br>1 Mienshao PAR 97<br>1 Hariyama MEG 73<br><br>Treinador: 26<br>1 Miriam SVI 251<br>1 Rock Chestplate SVI 192<br>1 Boss's Orders PAL 265<br>1 Buddy-Buddy Poffin TEF 144<br>1 Boss's Orders ASC 256<br>3 Premium Power Pro MEG 174<br>2 Fighting Gong MEG 168<br>1 Iono PAL 269<br>2 Night Stretcher SSP 251<br>1 Gravity Mountain SSP 250<br>1 Poppy OBF 220<br>1 Nest Ball PAF 84<br>2 Dawn PFL 129<br>1 Super Rod PAL 188<br>1 Switch PFL 123<br>1 Nest Ball SVI 181<br>1 Air Balloon SSH 156<br>1 Arven SVI 249<br>1 Fennel BLK 162<br>1 Unfair Stamp TWM 165<br>1 Switch EVO 88<br>1 Hassel TWM 205<br>3 Lillie's Determination MEG 184<br>1 Bravery Charm PAL 173<br>1 Rare Candy SVI 256<br>1 Tool Scrapper WHT 85<br><br>Energia: 2<br>10 Basic {F} Energy MEE 6<br>1 Ignition Energy WHT 86`)
  },
  {
    player: "Moises", week: 5, name: "S5 — Miraidon ex / Mega Eelektross ex", archetype: "Miraidon ex",
    deckList: d(`Pokémon: 10<br>1 Pawmi SCR 56<br>1 Pawmo PAL 75<br>2 Miraidon ex SVI 81<br>2 Mega Eelektross ex ASC 61<br>2 Plusle PAR 60<br>3 Eelektrik BLK 31<br>1 Pawmot PAL 76<br>2 Tynamo OBF 67<br>2 Minun PAR 61<br>1 Raikou MEG 48<br><br>Treinador: 19<br>1 Buddy-Buddy Poffin ASC 184<br>2 Canari ASC 185<br>2 Boss's Orders ASC 183<br>2 Earthen Vessel SFA 96<br>1 Poké Pad ASC 198<br>4 Electric Generator SVI 170<br>2 Arven PAF 235<br>1 Iono PAF 237<br>2 Nest Ball SUM 158<br>1 Technical Machine: Devolution PAR 177<br>2 Ultra Ball BRS 186<br>2 Dawn PFL 129<br>2 Super Rod PAL 188<br>1 Technical Machine: Evolution PAR 178<br>1 Hilda WHT 171<br>2 Levincia JTG 150<br>4 Lillie's Determination MEG 184<br>1 Mega Signal MEG 121<br>1 Switch MEW 206<br><br>Energia: 1<br>9 Basic {L} Energy SVE 12`)
  },
  {
    player: "Alan", week: 5, name: "S5 — Miraidon ex / Iron Hands ex", archetype: "Miraidon ex",
    deckList: d(`Pokémon: 10<br>1 N's Joltik JTG 49<br>2 Magneton SSP 59<br>2 Mega Manectric ex MEG 50<br>2 Electrike MEG 49<br>2 Iron Hands ex PRE 154<br>1 Zekrom ex BLK 34<br>2 Miraidon ex SVI 81<br>2 Magnemite MEG 45<br>1 Pikachu ex SSP 57<br>1 Zeraora DRI 78<br><br>Treinador: 15<br>4 Electric Generator SVI 170<br>1 Prime Catcher TEF 157<br>1 Night Stretcher SFA 61<br>3 Nest Ball SVI 181<br>2 Air Balloon BLK 79<br>3 Arven SVI 166<br>1 Professor Turo's Scenario PAR 171<br>1 Super Rod PAL 188<br>1 Professor's Research JTG 155<br>3 Lillie's Determination MEG 119<br>3 Iono PAF 80<br>1 Future Booster Energy Capsule TEF 149<br>4 Ultra Ball MEG 131<br>1 Vitality Band SVI 197<br>3 Boss's Orders MEG 114<br><br>Energia: 1<br>12 Basic {L} Energy Energy 39`)
  },
  // ── SEMANA 7 — Guerra de Times ────────────────────────────────────────────
  {
    player: "Erick", week: 7, name: "S7 — Meganium / Hydrapple ex / Ogerpon", archetype: "Meganium / Hydrapple ex",
    deckList: d(`Pokémon: 12<br>2 Chikorita ASC 8<br>2 Bayleef MEG 9<br>2 Meganium MEG 10<br>2 Applin SCR 12<br>1 Dipplin TWM 18<br>1 Dipplin DRI 17<br>1 Hydrapple ex SCR 14<br>1 Budew ASC 16<br>1 Hydrapple ex SCR 167<br>1 Hydrapple ex SCR 156<br>2 Teal Mask Ogerpon ex PRE 145<br>2 Teal Mask Ogerpon ex TWM 190<br><br>Treinador: 12<br>2 Handheld Fan TWM 150<br>4 Lillie's Determination MEG 119<br>3 Boss's Orders MEG 114<br>4 Dawn PFL 87<br>1 Lana's Aid TWM 155<br>1 Briar SCR 132<br>4 Bug Catching Set TWM 143<br>2 Ultra Ball MEG 131<br>2 Poké Pad POR 81<br>1 Unfair Stamp TWM 165<br>2 Night Stretcher ASC 196<br>4 Forest of Vitality MEG 117<br><br>Energia: 1<br>12 Basic {G} Energy MEE 1`)
  },
  {
    player: "Rodrigo", week: 7, name: "S7 — Mega Lucario ex / Mega Zygarde ex", archetype: "Mega Zygarde ex",
    deckList: d(`Pokémon: 8<br>2 Solrock MEG 75<br>2 Binacle POR 42<br>2 Mega Lucario ex MEG 179<br>1 Mega Zygarde ex POR 104<br>1 Mega Zygarde ex POR 120<br>2 Riolu MEP 10<br>2 Lunatone MEG 74<br>2 Barbaracle POR 43<br><br>Treinador: 14<br>3 Ultra Ball ASC 264<br>2 Energy Retrieval SVI 171<br>3 Carmine TWM 217<br>3 Boss's Orders ASC 256<br>4 Fighting Gong MEG 168<br>4 Premium Power Pro MEG 174<br>4 Lillie's Determination MEG 169<br>2 Judge DRI 222<br>1 Air Balloon MEG 166<br>1 Team Rocket's Watchtower DRI 180<br>1 Secret Box TWM 163<br>3 Poké Pad POR 113<br>2 Core Memory POR 70<br>2 Switch MEW 206<br><br>Energia: 2<br>9 Basic {F} Energy MEE 6<br>2 Rocky {F} Energy POR 87`)
  },
  {
    player: "Luiz", week: 7, name: "S7 — Kyogre / Mega Abomasnow ex", archetype: "Mega Abomasnow ex",
    deckList: d(`Pokémon: 4<br>3 Kyogre MEG 34<br>2 Snover MEG 35<br>4 Mega Abomasnow ex MEG 36<br>2 Snover MEG 35<br><br>Treinador: 3<br>3 Ultra Ball BRS 186<br>2 Dawn PFL 129<br>4 Larry's Skill PRE 115<br><br>Energia: 1<br>40 Basic {W} Energy SVE 11`)
  },
  {
    player: "Alan", week: 7, name: "S7 — Latias ex / Mega Starmie ex / Dusknoir", archetype: "Latias ex",
    deckList: d(`Pokémon: 11<br>1 Latias ex SSP 76<br>1 Bloodmoon Ursaluna ex TWM 141<br>1 Budew ASC 16<br>2 Dusknoir PRE 37<br>2 Munkidori TWM 95<br>2 Mega Starmie ex POR 21<br>3 Dusclops PRE 36<br>1 Fezandipiti ex ASC 142<br>1 Meowth ex POR 62<br>3 Staryu POR 20<br>4 Duskull PRE 35<br><br>Treinador: 11<br>3 Poké Pad POR 81<br>3 Pokégear 3.0 SVI 186<br>3 Risky Ruins MEG 127<br>2 Night Stretcher ASC 196<br>1 Judge POR 76<br>3 Hilda WHT 84<br>4 Buddy-Buddy Poffin TEF 144<br>4 Lillie's Determination MEG 119<br>4 Ultra Ball MEG 131<br>1 Wally's Compassion MEG 132<br>2 Boss's Orders MEG 114<br><br>Energia: 4<br>1 Legacy Energy TWM 167<br>3 Basic {D} Energy MEE 7<br>3 Basic {W} Energy MEE 3<br>2 Ignition Energy WHT 86`)
  },
  {
    player: "Moises", week: 7, name: "S7 — Mega Lucario ex / Mega Zygarde ex (Luta)", archetype: "Mega Lucario ex",
    deckList: d(`Pokémon: 9<br>3 Riolu MEG 76<br>2 Barbaracle POR 43<br>1 Fezandipiti ex SFA 92<br>2 Lunatone MEG 74<br>1 Mega Zygarde ex POR 120<br>3 Mega Lucario ex MEG 179<br>2 Solrock MEG 75<br>1 Meowth ex POR 62<br>2 Binacle POR 42<br><br>Treinador: 18<br>1 Tarragon POR 85<br>2 Poké Pad ASC 198<br>4 Lillie's Determination MEG 184<br>1 Secret Box TWM 163<br>1 Judge PAF 228<br>4 Fighting Gong MEG 168<br>2 Poké Pad ASC 198<br>2 Air Balloon BLK 79<br>2 Boss's Orders PAL 265<br>2 Night Stretcher MEG 173<br>2 Gravity Mountain SSP 250<br>3 Premium Power Pro MEG 174<br>2 Hilda WHT 171<br>2 Ultra Ball BRS 186<br>1 Blowtorch PFL 86<br>1 Tarragon POR 116<br>1 Brock's Scouting JTG 179<br>1 Team Rocket's Petrel DRI 226<br><br>Energia: 2<br>2 Rocky {F} Energy POR 87<br>7 Basic {F} Energy SVE 14`)
  },
  {
    player: "Moises", week: 7, name: "S7 — Mega Froslass ex / Mega Starmie ex", archetype: "Mega Froslass ex",
    deckList: d(`Pokémon: 10<br>3 Dunsparce PRE 79<br>1 Mega Froslass ex ASC 47<br>2 Mega Froslass ex ASC 265<br>2 Mega Starmie ex POR 21<br>1 Munkidori SFA 72<br>3 Dudunsparce TEF 129<br>1 Fezandipiti ex SFA 92<br>3 Snorunt TWM 51<br>1 Budew ASC 221<br>2 Staryu POR 20<br><br>Treinador: 20<br>2 Buddy-Buddy Poffin PRE 101<br>2 Boss's Orders PAL 265<br>1 Pokégear 3.0 BLK 84<br>1 Energy Retrieval SVI 171<br>3 Poké Pad POR 81<br>1 Gravity Mountain SSP 250<br>2 Night Stretcher SSP 251<br>2 Lucky Helmet TWM 158<br>1 Drayton SSP 232<br>2 Ultra Ball BRS 186<br>1 Hilda WHT 171<br>1 Crispin SCR 164<br>1 Secret Box TWM 163<br>1 Surfing Beach MEG 129<br>4 Lillie's Determination MEG 184<br>1 Judge PAF 228<br>1 Wally's Compassion MEG 186<br>1 Switch MEW 206<br>2 Hilda WHT 84<br>1 Mega Signal MEG 121<br><br>Energia: 4<br>6 Basic {W} Energy SVE 11<br>2 Basic {D} Energy SVE 15<br>1 Ignition Energy WHT 86<br>1 Ignition Energy PFL 124`)
  },
  {
    player: "Nakaima", week: 7, name: "S7 — Meganium / Mega Venusaur ex / Ogerpon", archetype: "Meganium",
    deckList: d(`Pokémon: 11<br>2 Teal Mask Ogerpon ex TWM 25<br>2 Meganium MEG 10<br>1 Fezandipiti ex SFA 38<br>1 Mega Venusaur ex MEG 177<br>2 Bayleef MEG 9<br>2 Chikorita MEG 8<br>1 Bulbasaur MEG 1<br>1 Ivysaur MEG 2<br>1 Mega Venusaur ex MEG 155<br>1 Bulbasaur MEG 133<br>1 Ivysaur MEG 134<br><br>Treinador: 26<br>1 Forest of Vitality MEG 117<br>1 Hassel TWM 205<br>3 Bug Catching Set TWM 143<br>4 Lillie's Determination MEG 184<br>1 Air Balloon SSH 156<br>1 Unfair Stamp TWM 165<br>1 Crushing Hammer POR 71<br>1 Pokégear 3.0 SVI 186<br>1 Switch PFL 123<br>1 Poké Ball POR 80<br>1 Roto-Stick PRE 127<br>1 Ultra Ball ROS 93<br>1 Energy Search POR 72<br>1 Boss's Orders PAL 265<br>1 Rare Candy MEG 175<br>2 Night Stretcher SSP 251<br>1 Repel MEG 126<br>1 Forest of Vitality MEG 117<br>1 Buddy-Buddy Poffin PRE 101<br>2 Dawn PFL 129<br>1 Lacey PRE 114<br>1 Boss's Orders RCL 200<br>1 Forest of Vitality ASC 188<br>1 Brock's Scouting JTG 179<br>1 Black Belt's Training JTG 144<br>1 Judge POR 76<br><br>Energia: 1<br>12 Basic {G} Energy MEE 1`)
  },
  {
    player: "Cristian", week: 7, name: "S7 — Mega Lucario ex / Annihilape", archetype: "Mega Lucario ex",
    deckList: d(`Pokémon: 8<br>2 Makuhita MEG 72<br>2 Mankey SSP 98<br>3 Mega Lucario ex MEG 77<br>1 Primeape SSP 99<br>3 Riolu MEG 76<br>1 Annihilape SSP 100<br>1 Annihilape SSP 100<br>2 Hariyama MEG 73<br><br>Treinador: 13<br>3 Air Balloon ASC 181<br>4 Lillie's Determination MEG 119<br>4 Poké Pad POR 81<br>2 Gravity Mountain SSP 177<br>2 Boss's Orders MEG 114<br>4 Fighting Gong MEG 116<br>3 Ultra Ball MEG 131<br>1 Wally's Compassion MEG 132<br>2 Judge POR 76<br>2 Dawn PFL 87<br>1 Unfair Stamp TWM 165<br>4 Premium Power Pro MEG 124<br>2 Rare Candy MEG 125<br><br>Energia: 1<br>11 Basic {F} Energy MEE 6`)
  },
  {
    player: "Rodrigo", week: 7, name: "S7 — Cynthia's Garchomp ex / Roserade", archetype: "Cynthia's Garchomp ex",
    deckList: d(`Pokémon: 12<br>2 Cynthia's Gabite ASC 110<br>1 Cynthia's Garchomp ex PR-SV 204<br>1 Cynthia's Garchomp ex DRI 215<br>2 Cynthia's Gabite ASC 110<br>3 Cynthia's Roserade DRI 184<br>2 Cynthia's Gible ASC 109<br>1 Cynthia's Gible DRI 102<br>1 Cynthia's Gible SVALT 176<br>1 Cynthia's Garchomp ex DRI 232<br>3 Cynthia's Roselia DRI 7<br>2 Budew ASC 221<br>1 Cynthia's Spiritomb ASC 244<br><br>Treinador: 14<br>3 Cynthia's Power Weight DRI 162<br>1 Unfair Stamp TWM 165<br>3 Hilda WHT 164<br>4 Fighting Gong MEG 168<br>4 Lillie's Determination MEG 169<br>3 Buddy-Buddy Poffin MEG 167<br>1 Team Rocket's Watchtower ASC 210<br>1 Switch MEW 206<br>2 Night Stretcher MEG 173<br>2 Premium Power Pro MEG 174<br>2 Boss's Orders ASC 256<br>2 Judge DRI 222<br>3 Poké Pad POR 113<br>2 Team Rocket's Petrel DRI 226<br><br>Energia: 2<br>2 Rocky {F} Energy POR 87<br>5 Basic {F} Energy SVE 6`)
  },
  {
    player: "Alan", week: 7, name: "S7 — Decidueye ex / Vivillon", archetype: "Decidueye ex",
    deckList: d(`Pokémon: 12<br>1 Fezandipiti ex ASC 288<br>2 Vivillon POR 9<br>2 Spewpa POR 8<br>3 Dartrix POR 11<br>1 Meowth ex POR 121<br>1 Relicanth TEF 173<br>2 Scatterbug SSP 5<br>2 Rowlet POR 90<br>1 Budew ASC 221<br>2 Rowlet POR 10<br>1 Shaymin DRI 10<br>3 Decidueye ex POR 12<br><br>Treinador: 16<br>1 Boss's Orders PAL 265<br>4 Ultra Ball MEG 131<br>4 Bug Catching Set TWM 143<br>1 Secret Box TWM 163<br>2 Boss's Orders PAL 172<br>1 Air Balloon MEG 166<br>1 Forest of Vitality POR 109<br>2 Dawn PFL 129<br>1 Morty's Conviction TEF 155<br>4 Lillie's Determination MEG 119<br>1 Judge DRI 222<br>2 Poké Pad POR 113<br>1 Colress's Tenacity SFA 87<br>2 Night Stretcher SFA 61<br>2 Forest of Vitality ASC 188<br>1 Lana's Aid TWM 155<br><br>Energia: 4<br>2 Ignition Energy WHT 86<br>1 Ignition Energy PFL 124<br>4 Growing {G} Energy POR 86<br>2 Basic {G} Energy MEE 1`)
  },
];

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const log: string[] = [];

    // Normaliza nome para match case-insensitive e acento
    const norm = (s: string) =>
      s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

    // Busca todos os jogadores e monta mapa nome→id
    const allPlayers = await prisma.player.findMany({ select: { id: true, displayName: true } });
    const playerMap = new Map<string, string>();
    for (const p of allPlayers) {
      playerMap.set(norm(p.displayName), p.id);
    }

    let created = 0, skipped = 0;

    for (const deck of DECKS) {
      const playerId = playerMap.get(norm(deck.player));
      if (!playerId) {
        log.push(`  ⚠ Jogador "${deck.player}" não encontrado — deck "${deck.name}" ignorado`);
        skipped++;
        continue;
      }

      // Idempotente: verifica se deck com mesmo nome já existe para o jogador
      const existing = await prisma.savedDeck.findFirst({
        where: { playerId, name: deck.name }
      });
      if (existing) {
        skipped++;
        continue;
      }

      await prisma.savedDeck.create({
        data: {
          playerId,
          name: deck.name,
          archetype: deck.archetype,
          deckList: deck.deckList,
          isPublic: true,
        }
      });
      created++;
      log.push(`  ✓ ${deck.player} — ${deck.name}`);
    }

    log.push(`\n✓ ${created} decks criados, ${skipped} ignorados`);
    log.push(`📌 Semana 6 (Construtor Misterioso) não possui dados de deck na planilha.`);
    log.push(`📌 Decks visíveis em /jogadores/{id} e no perfil público.`);

    return NextResponse.json({ success: true, log }, { status: 200 });
  } catch (err) {
    console.error("[seed-season2-decks]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
