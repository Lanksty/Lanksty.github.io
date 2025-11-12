import { createApp, ref, reactive, computed, onMounted, watch } from "vue";
import * as pkmn from "./_models.js";
import * as comp from "./components.js";


/// Load necessary data
const config = await pkmn.getConfigData();
const naturesList = await pkmn.fetchNatureData();
const typeChart = await pkmn.fetchTypeData();
const moveList = await pkmn.fetchMoveData();
const itemList = await pkmn.getItemData();
const abilitiesList = await pkmn.fetchAbilityData();
const pokemonList = await pkmn.fetchPokemonData()
  .then(data => {
      return data.filter(p => !config.excludedPokemon.includes(p.InternalName));
    })

const TMList = itemList
  .filter(i => i.Move)
  .filter(tm => {
    if(tm.FieldUse === "TM")
    {
      return config.allowedTMs.includes(tm.Name);
    }
    else {
      return true;
    }
  });

class TeamBuilder {
  constructor() {
    let savedTeam = localStorage.getItem('savedTeam');
    if (typeof savedTeam === "string" && savedTeam.length > 0 && savedTeam !== "undefined" && savedTeam !== "null") {
      try {
        let parsedTeam = JSON.parse(savedTeam);
        console.log("Loaded saved team:", parsedTeam);
        parsedTeam = pkmn.ParsePokemonList(parsedTeam);
        this.teamList = ref(parsedTeam);
      } catch (error) {
        console.error('Error parsing saved team:', error);
        this.teamList = ref(new Array(0)); // Initialize as a reactive reference to an array
      }
    } else {
      this.teamList = ref(new Array(0)); // Initialize as a reactive reference to an array
    }

    this.TeamEffectiveness = computed(() => this.getTeamEffectiveness());
    watch(this.TeamEffectiveness, (newVal) => {
      console.log("Team Effectiveness Updated:", newVal);
    });

    // Ensure the team always has 6 slots (filled with null if less than 6)
    this.filteredTeam = computed(() => {
      if(this.teamList.value.length < 6) {
        return [...this.teamList.value, ...new Array(6 - this.teamList.value.length).fill(null)];
      }
      return this.teamList.value;
    });
  }

  addPokemon(pokemon) {
    if(!pokemon.TypeMatchups) {
      pokemon.GetTypeMatchups(typeChart); // Fetch and populate type matchups if not already done
    }

    if(!pokemon.MoveList || pokemon.MoveList.length === 0) {
      pokemon.GetMoves(moveList); // Fetch and populate moves if not already done

    }
    if(!pokemon.TMMoves || pokemon.TMMoves.length === 0) {
      let list = TMList.filter(tm => pokemon.TutorMoves?.includes(tm.Move) );
      list = moveList.filter(mv => list.some(t => t.Move === mv.Name));
      
      pokemon.TMMoves = pokemon.ParseTMMoves(list);
    }

    if (this.teamList.length < 6) {
      console.log("Pokemon prior to cloning:", pokemon);
      pokemon = pokemon.Clone(); // Create a deep copy to avoid reference issues
      pokemon.TeamIndex = this.teamList.length + 1; // Assign TeamIndex based on current team size

      console.log("Adding Pokémon to team:", pokemon, "with TeamIndex:", pokemon.TeamIndex);
      this.teamList.push(pokemon);
      localStorage.setItem('savedTeam', JSON.stringify(this.teamList));
    } else {
      console.log("Team is full!");
    }
  }

  removePokemon(pokemon) {
    this.teamList = this.teamList.filter(p => p.TeamIndex != pokemon.TeamIndex);
    
    // Reassign TeamIndex values
    this.teamList.forEach((p, index) => {
      p.TeamIndex = index + 1;
    });
    localStorage.setItem('savedTeam', JSON.stringify(this.teamList));

    console.log(this.parent);
  }

  getTeam() {
    return this.teamList;
  }
  
  // Used in TeamEffectiveness tab to calculate overall team type matchups
  getTeamEffectiveness() {
    let allWeaknesses = [];
    let allResistances = [];
    let allImmunities = [];

    this.teamList.value.forEach(pokemon => {
      if (pokemon.TypeMatchups) {
        allWeaknesses.push(...pokemon.TypeMatchups.weaknesses);
        allResistances.push(...pokemon.TypeMatchups.resistances);
        allImmunities.push(...pokemon.TypeMatchups.immunities);
      }
    });

    let chart = new Map();
    typeChart.forEach(type => {
      chart.set(type.Name, { weaknesses: 0, resistances: 0, immunities: 0 });
    });

    allWeaknesses.forEach(type => {
      if (chart.has(type)) {
        chart.get(type).weaknesses += 1;
      }
    });

    allResistances.forEach(type => {
      if (chart.has(type)) {
        chart.get(type).resistances += 1;
      }
    });

    allImmunities.forEach(type => {
      if (chart.has(type)) {
        chart.get(type).immunities += 1;
      }
    });

    return chart;
  }

  abilityChangeCallback(pokemon) {
    console.log("Ability changed for", pokemon.Name);
    pokemon.GetTypeMatchups(typeChart);
    this.saveTeam();
  }

  saveTeam() {
    localStorage.setItem('savedTeam', JSON.stringify(this.teamList));
  }
}

const app = createApp({
  setup() {
    const teamBuilder = reactive(new TeamBuilder());
    const allPokemon = reactive([]);
    const allItems = reactive([]);
    const allMoves = reactive([]);
    const allAbilities = reactive([]);
    const types = reactive([]);
    const natures = reactive([]);
    const searchQuery = ref("");
    const typeFilter = ref([]); 
    const abilityFilter = ref([]);
    const moveFilter = ref([]);
    const moveTypeFilter = ref([]);
    const resistedByFilter = ref([]);
    const effectiveTypeFilter = ref([]);
    const moveCategoryFilter = ref([]);
    const moveCategories = reactive([
      { Name: "Physical" },
      { Name: "Special" },
      { Name: "Status" }
    ]);
    const searching = ref(false);
    const currentlyViewing = ref(null);
    const tabView = ref("team");
    const moveListTab = ref("levelup");
    const pokedexView = ref("");
    const sortingMethod = reactive({
      method: "number",
      subCategory: null,
      ascending: true
    });
    const pokedexTab = ref("info");

    const filteredPokemon = computed(() => {
      let filtered = allPokemon.filter(p => p.Name.toLowerCase().includes(searchQuery.value.toLowerCase()));

      // Filter by types
      if(typeFilter.value.length > 0) {
        filtered = filtered.filter(p => p.Types.includes(typeFilter.value[0].Name));

        if(typeFilter.value.length > 1) filtered = filtered.filter(p => p.Types.includes(typeFilter.value[1].Name));
      }
      
      // Filter by abilities
      if(abilityFilter.value.length > 0) {
        filtered = filtered.filter(p => p.AbilitiesList.some(ability => ability?.toLowerCase().replace(" ", "") === abilityFilter.value[0].Name?.toLowerCase().replace(" ", "")));
      }

      // Filter by moves
      if(moveFilter.value.length > 0) {
        filtered = filtered.filter(p => moveFilter.value.every(mv => p.Moves.includes(mv.Name)));
      }

      // Filter by types that the Pokémon resists
      if(resistedByFilter.value.length > 0) {
        filtered = filtered.filter(p => {
          if(!p.TypeMatchups) {
            p.GetTypeMatchups(typeChart);
          }
          return resistedByFilter.value.every(t => p.TypeMatchups.resistances.includes(t.Name) || p.TypeMatchups.immunities.includes(t.Name));
        });
      }

      // Filter by types that the Pokémons stab is effective against
      if (effectiveTypeFilter.value.length > 0) {
        // Get list of types that are effective against the selected types
        let typeList = types.filter(t => {
          return effectiveTypeFilter.value.some(et => et.Name == t.Name);
        });

        // typeList = typeList.flatMap(t => t.Weaknesses);
        
        filtered = filtered.filter(p => {
          return typeList.every(type => type.Weaknesses.some(weakness => p.Types.includes(weakness)));
        }); 
      }

      console.log(moveFilter.value[0], abilityFilter.value, typeFilter.value, searchQuery.value, resistedByFilter.value, filtered);

      return filtered;
    });

    const filteredAbilities = computed(() => {
      if(abilityFilter.value.length === 0) return allAbilities;
      let filtered = allAbilities.filter(a => abilityFilter.value.some(af => af.Name === a.Name));
      return filtered;
    });

    const filteredMoves = computed(() => {
      let filtered = allMoves;
      if(moveFilter.value.length > 0)
      {
          filtered = allMoves.filter(m => moveFilter.value.some(mf => mf.Name === m.Name));
      }

      if(moveTypeFilter.value.length > 0) {
        filtered = filtered.filter(m => moveTypeFilter.value.some(mt => mt.Name === m.Type));
      }

      if(moveCategoryFilter.value.length > 0) {
        filtered = filtered.filter(m => moveCategoryFilter.value.some(mc => mc.Name === m.Category));
      }

      return filtered;
    });

    const clearSearch = () => {
      searchQuery.value = "";
      typeFilter.value = [];
      abilityFilter.value = [];
      moveFilter.value = [];
    };

    const viewPokemon = computed(() => {
      if(currentlyViewing.value === null) return null;
      return teamBuilder.teamList.find(p => p.InternalName === currentlyViewing.value) || null;
    });

    const getAbilityByName = (name) => {
      return allAbilities.find(a => a.Name?.normalizeName() === name?.normalizeName()) || null;
    };
    
    const toggleViewingPokemon = (pokemon) => {
      moveListTab.value = "levelup";
      if(viewPokemon.value && pokemon.InternalName === viewPokemon.value.InternalName) {
        currentlyViewing.value = null;
      } else {
        currentlyViewing.value = pokemon.InternalName;
        tabView.value = "team";
      }
    }

    const buildEvolutionChain = (pokemon) => {
      let baseForm = pokemon.GetEvolutions(allPokemon)[0]; // Get the base form of the evolution chain
      if (!baseForm) return [];

      // Recursive function to build the evolution chain
      const buildChain = (currentPokemon) => {
        // Always return an array. Return [] for null/undefined inputs.
        if (!currentPokemon) return [];

        // Base case: no further evolutions -> return array with this pokemon
        if (!currentPokemon.EvolvesInto || currentPokemon.EvolvesInto.length === 0) {
          return [currentPokemon];
        }

        let evoChain = [];
        currentPokemon.EvolvesInto.forEach((evo) => {
          let evoPokemon = allPokemon.find((p) => p.InternalName === evo);
          if (evoPokemon) {
            // Add the current pokemon as the branch prefix
            evoChain.push(currentPokemon);

            // concat the child's chain into our chain and reassign (concat does not mutate)
            const child = buildChain(evoPokemon);
            if (child && child.length) {
              evoChain = evoChain.concat(child);
            }
          }
        });

        
        return evoChain;
      };
      
      // Build full evolution chain starting from baseForm
      let chain = [];
      baseForm.EvolvesInto.forEach((evo) => {
        let evoPokemon = allPokemon.find((p) => p.InternalName === evo);
        if (evoPokemon) {
          let subChain = [baseForm];
          
          const child = buildChain(evoPokemon);
          if (child && child.length) {
            subChain = subChain.concat(child);
          }
          chain.push(subChain);
        }  
      });
      
      console.log("Built evolution chain for", baseForm.Name, ":", chain);
      return chain;
    };

    const pokemon = computed(() => {
      console.log("Pokedex view changed to:", pokedexView.value);
      if (pokedexView.value === "" || pokedexView.value === null) return null;
      let pokemon = allPokemon.find(p => p.InternalName === pokedexView.value);
      if(!pokemon) return null;

      if(!pokemon.TypeMatchups) {
        pokemon.GetTypeMatchups(typeChart); // Fetch and populate type matchups if not already done
      }
      if(!pokemon.MoveList || pokemon.MoveList.length === 0) {
        pokemon.GetMoves(moveList); // Fetch and populate moves if not already done
      }

      if(!pokemon.TMMoves || pokemon.TMMoves.length === 0) {
        let list = TMList.filter(tm => pokemon.TutorMoves?.includes(tm.Move) );
        list = moveList.filter(mv => list.some(t => t.Move === mv.Name));
        pokemon.TMMoves = pokemon.ParseTMMoves(list);
      }

      console.log("Viewing Pokémon:", pokemon);
      pokedexTab.value = "info";
      return pokemon;
    });

    const sortList = (list) => {
      let sortedList = [...list];
      const method = sortingMethod.method;
      const subCategory = sortingMethod.subCategory;
      const ascending = sortingMethod.ascending;

      sortedList.sort((a, b) => {
        // Define initial values for comparison
        let aValue = a[method];
        let bValue = b[method];
        
        // Only access subCategory if it exists to avoid null reference errors
        if(subCategory) {
          aValue = a[method] ? a[method][subCategory] : undefined;
          bValue = b[method] ? b[method][subCategory] : undefined;
        }

        if(aValue === undefined) aValue = null;
        if(bValue === undefined) bValue = null;

        if(parseInt(aValue)) aValue = parseInt(aValue);
        if(parseInt(bValue)) bValue = parseInt(bValue);

        if (aValue < bValue) return ascending ? -1 : 1;
        if (aValue > bValue) return ascending ? 1 : -1;

        return 0;
      });
      return sortedList;
    }

    const chevronClass = (method) => {
      if(sortingMethod.subCategory) {
        return {
          'bi-chevron-up': !sortingMethod.ascending && sortingMethod.subCategory === method,
          'bi-chevron-down': sortingMethod.ascending && sortingMethod.subCategory === method
        };
      }
      return {
        'bi-chevron-up': !sortingMethod.ascending && sortingMethod.method === method,
        'bi-chevron-down': sortingMethod.ascending && sortingMethod.method === method
      };
    }

    const setTabView = (tabName) => {
      currentlyViewing.value = null;
      tabView.value = tabName;
      sortingMethod.method = "number";
      sortingMethod.ascending = true;
    }

    const showPokemonInSearch = (filter, filterType) => {
      clearSearch();
      if (filterType === "type") {
        typeFilter.value = [filter];
      } else if (filterType === "ability") {
        abilityFilter.value = [filter];
      } else if (filterType === "move") {
        moveFilter.value = [filter];
      }
      setTabView("allPokemon");
    }

    const setSortingMethod = (method, subCategory = null) => {
      sortingMethod.method = method;
      sortingMethod.subCategory = subCategory;
      if(sortingMethod.method === method) {
        sortingMethod.ascending = !sortingMethod.ascending;
      } else {
        sortingMethod.ascending = true;
      }
    }

    const addToTeam = (pokemon) => {
      teamBuilder.addPokemon(pokemon);
      pokedexView.value = "";
      tabView.value = "team";
      searching.value = false;
      currentlyViewing.value = pokemon.InternalName;
    }

    const getMoveEffectiveness = (moves) => {
      if(moves instanceof pkmn.Pokemon) {
        moves = moves.SelectedMoves.filter(mv => mv != null && mv.Category !== "Status");
      }
      
      const effectiveness = {
        resistedBy: [],
        superEffectiveAgainst: [],
        unaffectedBy: [],
        neutral: []
      };
      if(!(moves instanceof Array)) {
        moves = [moves];
      }

      for(const move of moves) {
        if(move == null || move.Category === "Status") continue;
        let resistedBy = types.filter(t => t.Resistances?.includes(move.Type)).map(t => t.Name);
        let superEffectiveAgainst = types.filter(t => t.Weaknesses?.includes(move.Type)).map(t => t.Name);
        let unaffectedBy = types.filter(t => t.Immunities?.includes(move.Type)).map(t => t.Name);
        let neutral = types.filter(t => !t.Weaknesses?.includes(move.Type) && !t.Resistances?.includes(move.Type) && !t.Immunities?.includes(move.Type)).map(t => t.Name);

        effectiveness.resistedBy.push(...resistedBy);
        effectiveness.superEffectiveAgainst.push(...superEffectiveAgainst);
        effectiveness.unaffectedBy.push(...unaffectedBy);
        effectiveness.neutral.push(...neutral);
      }


      effectiveness.resistedBy = new Set(effectiveness.resistedBy);
      effectiveness.superEffectiveAgainst = new Set(effectiveness.superEffectiveAgainst);
      effectiveness.unaffectedBy = new Set(effectiveness.unaffectedBy);
      effectiveness.neutral = new Set(effectiveness.neutral);
      return effectiveness;
    }

    const getEggMoves = (pokemon) => {
      if(!pokemon.EggMovesList || pokemon.EggMovesList.length === 0) {
        pokemon = pokemon.GetEvolutions(allPokemon)[0];
        if(!pokemon) return [];
        
        return pokemon.EggMovesList.length ? pokemon.EggMovesList : pokemon.GetEggMoves(allMoves);
      }
      return pokemon.EggMovesList;
    }

    const getStatBarColor = (statValue) => {
      if(statValue >= 150) {
        return "#00ffff"; // Light blue for extremely high stats
      } else if(statValue >= 115) {
        return "#006ae4"; // Blue for high stats
      }else if (statValue >= 95) {
        return "#4caf50"; // Green for average stats
      } else if(statValue >= 80) {
        return "#ffeb3b"; // Yellow for below average stats
      } else if(statValue >= 60) {
        return "#ff9800"; // Orange for low stats
      } else {
        return "#f44336"; // Red for extremely low stats
      }
    }

    watch(viewPokemon, (newVal) => {
      if(newVal != null && newVal.Name) {
        watch(newVal.SelectedMoves, (moves) => {
          console.log("Selected moves changed for", newVal.Name, moves);
          teamBuilder.saveTeam();
        }, { deep: true });
        watch(newVal.Evs, (evs) => {
          console.log("EVs changed for", newVal.Name, evs);
          teamBuilder.saveTeam();
        }, { deep: true });
        watch(newVal.Ivs, (ivs) => {
          console.log("IVs changed for", newVal.Name, ivs);
          teamBuilder.saveTeam();
        }, { deep: true });
      } 
      if(newVal == null) {
        currentlyViewing.value = null;
      }
    }, { deep: true});

    watch(typeFilter, val => {
      console.log(val)
    })

    watch(searching, val => {
      searchQuery.value = "";
      typeFilter.value = [];
    });



    onMounted( async () => {
      types.push(...await typeChart);
      allItems.push(...await itemList);
      allMoves.push(...await moveList);
      allPokemon.push(...pkmn.ParsePokemonList(await pokemonList, allMoves));
      allAbilities.push(...await abilitiesList);
      natures.push(...await naturesList);

      console.log(types);
    });


    
    return {
      teamBuilder,
      allPokemon,
      searchQuery,
      filteredPokemon,
      searching,
      types,
      typeFilter,
      clearSearch,
      currentlyViewing,
      viewPokemon,
      toggleViewingPokemon,
      allItems,
      tabView,
      setTabView,
      moveListTab,
      allMoves,
      allAbilities,
      abilityFilter,
      moveFilter,
      filteredAbilities,
      showPokemonInSearch,
      filteredMoves,
      moveTypeFilter,
      pokedexView,
      pokemon,
      setSortingMethod,
      sortingMethod,
      sortList,
      chevronClass,
      addToTeam,
      moveCategoryFilter,
      moveCategories,
      pokedexTab,
      getAbilityByName,
      getMoveEffectiveness,
      getEggMoves,
      getStatBarColor,
      buildEvolutionChain,
      natures,
      resistedByFilter,
      effectiveTypeFilter
    };
  }
});

app.component('search-dropdown', comp.SearchDropdown);

app.mount("#app");

