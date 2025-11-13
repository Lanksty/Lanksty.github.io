const config = await getConfigData();
const natureData = await fetchNatureData();

const hasExtensions = window.extensionsLoaded || false;
if (!hasExtensions) {
    throw new Error('_extensions.js not loaded!');
}

export class Pokemon {
    constructor(data, id, moveList) {
        Object.assign(this, data);

        // Copy base stats into a more convenient structure
        if (data.BaseStats && data.BaseStats.length === 6) {
            this.Stats = {
                hp: data.BaseStats[0],
                atk: data.BaseStats[1],
                def: data.BaseStats[2],
                spe: data.BaseStats[3],
                spa: data.BaseStats[4],
                spd: data.BaseStats[5]
            }
        } else {
            this.Stats = null; // Handle cases where BaseStats is missing or malformed
        }

        this.Types = [data.Type1, data.Type2].filter(Boolean); // Filter out null/undefined types
        this.MoveList = (data.MoveList || []).map(m => new Move(m)); // Ensure MoveList is an array of Move instances
        this.AbilitiesList = data.Abilities.split(',').map(a => a.trim());
        this.AbilitiesList.push(data.HiddenAbility); // Add "None" option for abilities
        this.Sprite = `./resources/images/front/${data.InternalName}.png`;
        this.TypeMatchups = data.TypeMatchups ?? null; // To be populated by GetTypeMatchups
        this.SelectedMoves = data.SelectedMoves ?? []; // To be populated by user selection. ToDo: add vue watcher to ensure max 4 moves // Move to main app?
        this.SelectedAbility = data.SelectedAbility ?? this.AbilitiesList[0]; // To be populated by user selection. ToDo: add vue watcher to ensure max 1 ability // Move to main app?
        this.HeldItem = data.HeldItem ?? null; // To be populated by user selection
        this.id = id; // Unique identifier for the Pokemon instance
        this.TMMoves = (data.TMMoves || []).map(m => new Move(m)); // List of TM moves available to this Pokémon
        this.EvolveData = data.Evolutions?.split(',').map(e => e.trim()) ?? []; // List of possible evolutions
        this.EggMovesList = data.EggMovesList ? data.EggMovesList.map(m => new Move(m)) : []; // List of egg moves available to this Pokémon
        this.EVs = data.EVs ?? { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }; // Set default EVs if not provided
        this.IVs = data.IVs ?? { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }; // Set default IVs if not provided
        this.Level = data.Level ?? 50; // Default level to 50 if not provided
        this.Nature = this.ParseNatureData(data.Nature) || null; // Parse nature data

        this.EvolvesInto = [];
        this.EvolvesAt = {};
        this.EvolveMethod = {};
        this.FormsList = data.FormsList ?? [];

        if(data.Forms && this.FormsList.length === 0) {
            data.Forms.forEach(form => {
                let parsedForm = new Pokemon(form, id); // Merge base data with form-specific data
                this.FormsList.push(parsedForm);
            })
        }

        for (let i = 0; i < this.EvolveData.length; i += 3) {
            this.EvolvesInto.push(this.EvolveData[i] || null);
            this.EvolveMethod[this.EvolveData[i] || null] = this.EvolveData[i + 1] || null;
            this.EvolvesAt[this.EvolveData[i] || null] = this.EvolveData[i + 2] || null;
        }

        this.TotalEVs = function() {
            return Object.values(this.EVs).reduce((a, b) => a + b, 0);
        };
    }

    GetTypeMatchups(typeChart) {
        typeChart = typeChart ?? fetchTypeData(); // If not parsed in then fetch it
        
        let ability = this.SelectedAbility.normalizeName().toUpperCase();
        let abilityImmunities = config.AbilityTypeImmunities || {}; // e.g. { "LEVITATE": ["GROUND"], ... }

        // Normalize keys (all ability names are single word upper case)
        for(const [key, value] of Object.entries(abilityImmunities)) {
            abilityImmunities[key.normalizeName().toUpperCase()] = value;
        }

        let immunityFromAbility = abilityImmunities[ability] || [];

        console.log("Getting type matchups for", this.Name, this.Types, typeChart);

        if (!typeChart) {
            console.error('Type chart data is not available.');
            return null;
        }

        const matchups = new Array();
        for (const type of this.Types) {
            matchups.push(typeChart.find(t => t.Name === type));
        }

        let weaknesses = matchups.filter(m => m && m.Weaknesses).flatMap(m => m.Weaknesses);
        let resistances = matchups.filter(m => m && m.Resistances).flatMap(m => m.Resistances);
        let immunities = matchups.filter(m => m && m.Immunities).flatMap(m => m.Immunities);

        // Add immunities from ability
        immunities = immunities.concat(immunityFromAbility).unique();

        // Remove resistances that are also weaknesses
        let filteredWeaknesses = weaknesses.filter(w => !resistances.includes(w));
        let filteredResistances = resistances.filter(r => !weaknesses.includes(r));

        // Remove any immunities from weaknesses and resistances
        filteredWeaknesses = filteredWeaknesses.filter(w => !immunities.includes(w));
        filteredResistances = filteredResistances.filter(r => !immunities.includes(r));

        this.TypeMatchups = { weaknesses: filteredWeaknesses, resistances: filteredResistances, immunities };

        console.log("Type matchups for", this.Name, this.TypeMatchups);
    }

    FindMatchup(type) {
        if (!this.TypeMatchups) {
            console.warn('Type matchups not calculated yet. Call GetTypeMatchups first.');
            return null;
        }
        // Length determines level of effectiveness
        // Immunity trumps everything, then resistance, then weakness
        // 0 = immune, 0.25 = double resist, 0.5 = resist, 1 = neutral, 2 = weak, 4 = double weak

        let im = this.TypeMatchups.immunities.filter(t => t === type).length;
        let re = this.TypeMatchups.resistances.filter(t => t === type).length;
        let we = this.TypeMatchups.weaknesses.filter(t => t === type).length;

        if (im > 0) return 0;
        if (re == 1) return 0.5;
        if (re > 1) return 0.25;
        if (we == 1) return 2;
        if (we > 1) return 4;
        return 1; // Neutral
    }

    FindStabMatchup(type) {
        if (!type.Name || (!type.Weaknesses && !type.Resistances && !type.Immunities)) {
            console.warn('Type data is incomplete.');
            return 1; // Neutral
        }
        const typeName = type.Name;
        let fullList = type.Weaknesses.concat(type.Resistances).concat(type.Immunities).unique();
        
        
        let we = type.Weaknesses?.filter(t => this.Types.includes(t)).length;
        let im = type.Immunities?.filter(t => this.Types.includes(t)).length;
        let re = type.Resistances?.filter(t => this.Types.includes(t)).length;
        let neutral = this.Types.some(t => !fullList.includes(t));
        
        if (we > 0) return 2; // At least one weakness
        if (neutral) return 1; // If any of this Pokémon's types don't appear in the type's matchup list, it's neutral
        if (re > 0) return 0.5; // Since no weaknesses, at least one resistance
        if (im > 0) return 0; // Since no weaknesses or resistances, at least one immunity
        return 1; // Else must be neutral
    }

    GetMoves(moveList) {
        moveList = moveList ?? fetchMoveData(); // If not parsed in then fetch it
        console.log("Getting moves for", this.Name, this.MoveList);
        if (!moveList) {
            console.error('Move list data is not available.');
            return [];
        }

        this.MoveList = moveList.filter(mv => this.Moves.includes(mv.Name));

        let moveArray = [];
        let level = null;
        for (const moveName of this.Moves) {
            if (parseInt(moveName)) {
                level = parseInt(moveName);
            }
            else {
                let move = moveList.find(mv => mv.Name === moveName);
                if (move) {
                    move = new Move(move);
                    move.LevelLearned = level;
                    moveArray.push(move);
                    level = null;
                }
            }
        }

        this.MoveList = moveArray;
        console.log("Moves for", this.Name, this.MoveList);
        return this.MoveList;
    }

    ParseTMMoves(TMList) {
        this.TMMoves = TMList.map(tm => new Move(tm));
        return this.TMMoves;
    }

    GetEggMoves(moveList) {
        moveList = moveList ?? fetchMoveData(); // If not parsed in then fetch it
        if (!moveList) {
            console.error('Move list data is not available.');
            return [];
        }
        let eggMoveList = moveList.filter(mv => this.EggMoves?.includes(mv.Name));
        this.EggMovesList = eggMoveList?.map(mv => new Move(mv));
        return this.EggMovesList;
    }

    GetMoveByName(name, moveList = null) {
        if (moveList === null) moveList = this.MoveList;

        return moveList.find(m => m.Name.toLowerCase() === name.toLowerCase()) || null;
    }

    HasMoveOfType(type) {
        if (type instanceof Type) {
            type = type.Name;
        }
        return this.MoveList.some(m => m.Type === type);
    }

    AddMove(move) {
        if (this.SelectedMoves.length >= 4) {
            console.warn('Cannot select more than 4 moves.');
            return false;
        }

        if(move instanceof String) {
            move = this.GetMoveByName(move);
        }

        if (!move) {
            console.error('Move not found.');
            return false;
        }

        this.SelectedMoves.push(move);
        return true;
    }

    RemoveMove(move) {
        if(move instanceof String) {
            move = this.GetMoveByName(move);
        }
        if (!move) {
            console.error('Move not found.');
            return false;
        }
        
        this.SelectedMoves = this.SelectedMoves.filter(m => m.Name !== move.Name);
        return true;
    }

    GetHeldItem() {
        return this.HeldItem;
    }

    SetHeldItem(item) {
        if(item instanceof String) {
            item = new Item({ InternalName: item, Name: item }); // Simplified; in real case, fetch full item data
        }
        else if (item.Name) {
            item = new Item(item);
        }
        else if (!(item instanceof Item)) {
            console.error('Invalid item.');
            return;
        }
        console.log(`Set held item for ${this.Name} to ${item.Name}`);
        this.HeldItem = item;
        return true;
    }

    GetEvolutions(pokemonList) {
        let evolutions = this.EvolutionLine?.split(',') || [];
        evolutions = evolutions.map(evoName => {
            let name = evoName.replace(/\(.*?\)/g, '').trim();
            return pokemonList.find(p => p.InternalName === name);
        });

        return evolutions.filter(evo => evo !== undefined);
    }

    GetBaseStatTotal() {
        if (!this.Stats) {
            return 0;
        }
        return parseInt(this.Stats.hp) + parseInt(this.Stats.atk) + parseInt(this.Stats.def) + parseInt(this.Stats.spa) + parseInt(this.Stats.spd) + parseInt(this.Stats.spe);
    }

    GetStatCalc(level = this.Level) {
        // Calculate actual stats based on level, IVs, EVs, and base stats
        // Formula: 
        // For HP: ((2 * Base + IV + (EV/4)) * Level / 100) + Level + 10
        // For other stats: (((2 * Base + IV + (EV/4)) * Level / 100) + 5) * Nature where nature is ignored for now

        if(!this.Stats) {
            console.warn('Base stats not available for stat calculation.');
            return null;
        }
        
        const stats = {};

        for (const [stat, base] of Object.entries(this.Stats)) {
            const iv = this.IVs[stat] || 0;
            const ev = this.EVs[stat] || 0;
            if (stat === 'hp') {
                stats[stat] = Math.floor(((2 * base + iv + (ev / 4)) * level / 100) + level + 10);
            } else {
                stats[stat] = Math.floor((((2 * base + iv + (ev / 4)) * level / 100) + 5) * 1);
            }
        }

        // Calc nature modifications here
        if (this.Nature && this.Nature.multipliers) {
            for (const [stat, modifier] of Object.entries(this.Nature.multipliers)) {
                if (stats[stat]) {
                    stats[stat] = Math.floor(stats[stat] * modifier);
                }
            }
        }

        return stats;
    }

    ParseNatureData(nature) {
        if(nature instanceof String) {
            let nature = natureData.find(n => n.name.toLowerCase() === nature.toLowerCase());
        }

        this.Nature = nature || { name: "Hardy" }; // Default nature if not found
        return this.Nature;
    }

    Clone() {
        return new Pokemon({ ...this }, this.id);
    }
}

class Move {
    constructor(data) {
        Object.assign(this, data);

        this.Sprite = `./resources/images/moves/${data.Category.toUpperCase()}.png`;
    }
}

class Item {
    constructor(data) {
        Object.assign(this, data);

        this.Sprite = `./resources/images/items/${data.InternalName}.png`;
    }
}

class Type {
    constructor(data) {
        Object.assign(this, data);

        this.Sprite = `./resources/images/types/${data.Name}.png`;
    }

    GetTypeEffectiveness(attackingType) {
        if(attackingType instanceof Type) {
            attackingType = attackingType.Name;
        }

        if (this.Immunities?.includes(attackingType)) {
            return 0;
        }
        if (this.Resistances?.includes(attackingType)) {
            return 0.5;
        }
        if (this.Weaknesses?.includes(attackingType)) {
            return 2;
        }
        return 1;
    }
}


// TrainerDex is the main model that holds all data for trainers and their pokemon
// Takes all data and organizes it into TrainerModels, allows for searching and filtering through all trainers
export class TrainerDex {
    constructor(TrainerList, PokemonList, MoveList, ItemList) {
        this.AllPokemon = PokemonList;
        this.AllTrainers = TrainerList;
        this.AllMoves = MoveList;
        this.AllItems = ItemList;
        this.Trainers = [];
        this.SelectedTrainer = null;
    }

    AssignLists(TrainerList, PokemonList, MoveList, ItemList) {
        this.AllPokemon = PokemonList;
        this.AllTrainers = TrainerList;
        this.AllMoves = MoveList;
        this.AllItems = ItemList;
    }

    ParseTrainerData() {
        let TrainerGroups = {}; // Object to collect all versions of a trainer
        
        this.AllTrainers.forEach(trainerData => {
            let name = trainerData.Name + '_' + trainerData.Type; // Unique key for each trainer based on name and type
            if (!TrainerGroups[name]) {
                TrainerGroups[name] = [];
            }
            TrainerGroups[name].push(trainerData);
        });

        this.Trainers = Object.values(TrainerGroups).map(trainerArray => {
            trainerArray = trainerArray.sort((a, b) => a.Version - b.Version); // Sort by version number
            let trainerModel = new TrainerModel(trainerArray); // Create TrainerModel for each group
            return trainerModel;
        });
        return this.Trainers;
    }

    GetTrainerByName(name) {
        return this.Trainers.find(t => t.Name.toLowerCase() === name.toLowerCase()) || null;
    }

    SearchTrainers(query) {
        query = query.normalizeName();
        return this.Trainers.filter(t => t.Name.normalizeName().includes(query));
    }

    GetAllTrainers() {
        return this.Trainers;
    }

    SelectTrainer(trainer) {
        trainer.AssignPokemonToVersions(this.AllPokemon, this.AllMoves, this.AllItems);
        this.SelectedTrainer = trainer;
        console.log('Selected trainer:', trainer);
    }
}

// Trainers have multiple versions based on difficulty or progress in the game
// Each version has a different set of pokemon
// Trainer model takes a list of the same trainer with different versions and stores each versions data
class TrainerModel {
    constructor(trainerArray) {
        if(trainerArray.length === 0) {
            throw new Error('Trainer array is empty.');
        }

        this.Name = trainerArray[0].Name;
        this.Type = trainerArray[0].Type;
        this.TrainerCount = trainerArray.length;
        this.Versions = trainerArray.map(t => new Trainer(t));
        this.SelectedVersionIndex = 0;
        this.SelectedVersion = () => this.Versions[this.SelectedVersionIndex];

        this.Sprite = `./resources/images/trainers/${this.Type}.png`;
        this.AlternateSprite = './resources/images/trainers/GENERIC.png';
    }

    GetTrainer(versionIndex) {
        if(versionIndex < 0 || versionIndex >= this.Versions.length) {
            console.warn('Invalid trainer version index. Returning first version.');
            return this.Versions[0];
        }

        return this.Versions[versionIndex];
    }

    // Short alias for GetTrainer
    Version(versionIndex) {
        return this.GetTrainer(versionIndex);
    }

    GetAllVersions() {
        return this.Versions;
    }

    // Get highest level pokemon in the specified trainer version
    GetTrainerLevel(index) {
        let version = this.GetTrainer(index);
        if (!version || !version.PokemonList || version.PokemonList.length === 0) {
            console.warn('No Pokémon data available for this trainer version.');
            return null;
        }

        return version.PokemonList.reduce((max, p) => p.Level > max ? p.Level : max, 0); // Max level among trainers mons
    }

    // Takes list of all pokemon, moves, and items to assign full data to each trainer's pokemon
    AssignPokemonToVersions(pokemonList, moveList, itemList) {
        this.Versions.forEach(version => {
            version.CretePokemonList(pokemonList, moveList, itemList);
        });
    }
}

class Trainer {
    constructor(data) {
        Object.assign(this, data);

        if(data.PokemonList) {
            this.PokemonList = data.PokemonList.map(p => new Pokemon(p));
        }

        this.Sprite = `./resources/images/trainers/${data.Type}.png`;
        this.AlternateSprite = './resources/images/trainers/GENERIC.png';
    }

    // Create list for the trainer based on pokemon data as trainer data does not have full pokemon info
    CretePokemonList(pokemonList, moveList, itemList) {
        if (this.PokemonList && this.PokemonList.length > 0) {
            return this.PokemonList; // Already created
        }

        let pokemon = this.Pokemon;
        if(!pokemon || pokemon.length === 0) {
            console.warn('No Pokémon data provided for trainer.');
            return [];
        }

        this.PokemonList = pokemon.map(mon => {
            let pData = {...pokemonList.find(p => p.InternalName === mon.Name)};
            let newPokemon = {...mon};
            if (!pData) return;

            Object.assign(pData, mon); // Override base data with trainer-specific data
            Object.assign(newPokemon, pData);

            if(mon.AbilityIndex) {
                newPokemon.SelectedAbility = newPokemon.AbilitiesList[mon.AbilityIndex];
            }
            else {
                newPokemon.SelectedAbility = newPokemon.AbilitiesList[0];
            }

            if(mon.Moves && moveList) {
                newPokemon.SelectedMoves = mon.Moves.map(move => {
                    return moveList.find(mv => mv.Name === move);
                })
            }

            if(mon.SelectedItem && itemList) {
                let itemData = itemList.find(it => it.Name === mon.SelectedItem || it.InternalName === mon.SelectedItem);
                if(itemData) {
                    newPokemon.HeldItem = new Item(itemData);
                }
            }
            
            newPokemon = new Pokemon(newPokemon);
            if(newPokemon.SelectedMoves.length === 0 && !mon.Moves && moveList) { // If no moves specified, get last 4 moves learned up to current level
                let moves = newPokemon.GetMoves(moveList).filter(mv => mv.LevelLearned <= (mon.Level)).sort((a, b) => a.LevelLearned - b.LevelLearned);
                newPokemon.SelectedMoves = moves.slice(-4); // Last 4 moves learned up to current level
            }

            return newPokemon;
        });

        return this.PokemonList;
    }
}


//
/// Helper/Data fetching functions
//

export function ParsePokemonList(pokemonList, moveList = null) {
    return pokemonList.map((p, index) => {
        return new Pokemon(p, index, moveList);
    });
}

export function FindPokemonByName(pokemonList, name) {
    return pokemonList.find(p => p.Name.toLowerCase() === name.toLowerCase()) || null;
}

export function fetchTypeData() {
    return fetch('./resources/data/types.json')
        .then(response => response.json())
        .then(data => {
            data = data.filter(t => t.Name != "???" && t.Name != "TYPELESS"); // Remove any invalid types
            data = data.map(t => new Type(t));
            return data;
        })
        .catch(error => {
            console.error('Error fetching type data:', error);
            return null;
        });
}

export function fetchPokemonData() {
    return fetch('./resources/data/pokemon_with_encounters.json')
    .then(response => response.json())
    .then(data => ParsePokemonList(data))
    .catch(error => {
        console.error('Error fetching Pokémon data:', error);
        return [];
    });
}

export function fetchMoveData() {
    return fetch('./resources/data/moves.json')
    .then(response => response.json())
    .then(data => data)
    .catch(error => {
        console.error('Error fetching move data:', error);
        return [];
    });
}

export function getItemData() {
    return fetch('./resources/data/items.json')
    .then(response => response.json())
    .then(data => data.map(i => new Item(i)))
    .catch(error => {
        console.error('Error fetching item data:', error);
        return [];
    });
}

export function fetchAbilityData() {
    return fetch('./resources/data/abilities.json')
    .then(response => response.json())
    .then(data => data)
    .catch(error => {
        console.error('Error fetching ability data:', error);
        return [];
    });
}

export function getConfigData() {
    return fetch('./resources/data/config.json')
    .then(response => response.json())
    .then(data => data)
    .catch(error => {
        console.error('Error fetching config data:', error);
        return {};
    });
}

export function fetchNatureData() {
    return fetch('./resources/data/natures.json')
    .then(response => response.json())
    .then(data => data)
    .catch(error => {
        console.error('Error fetching nature data:', error);
        return [];
    });
}

export function fetchTrainerData() {
    return fetch('./resources/data/trainers.json')
    .then(response => response.json())
    .then(data => data)
    .catch(error => {
        console.error('Error fetching trainer data:', error);
        return [];
    });
}