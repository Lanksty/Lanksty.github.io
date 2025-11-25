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

class TeamLoader {
  constructor() {
    // Handle old team format
    let team = localStorage.getItem('savedTeam');
    if (typeof team === "string" && team.length > 0 && team !== "undefined" && team !== "null") {
      try {
        let oldList = JSON.parse(team);
        let newTeam = new Team({ Name: "New Team", PokemonList: oldList });
        this.SavedTeams = reactive([newTeam]);
        this.SaveTeam(newTeam); // Save in new format
        localStorage.removeItem('savedTeam'); // Remove old format
        console.log("Converted old team format to new format:", newTeam);
      } catch (error) {
        console.error('Error parsing old team format:', error);
      }
    }

    // Get teams from local storage
    let savedTeams = localStorage.getItem('savedTeams');
    if (typeof savedTeams === "string" && savedTeams.length > 0 && savedTeams !== "undefined" && savedTeams !== "null") {
      try {
        let teams = JSON.parse(savedTeams);
        teams = teams.map(t => {
          if(t instanceof Array) {
            // Handling old format where only PokemonList was saved
            return new Team({ Name: "Unnamed Team", PokemonList: t });
          }
          return new Team(t);
        });

        this.SavedTeams = reactive(teams);
        console.log("Loaded saved teams:", this.SavedTeams);
      } catch (error) {
        console.error('Error parsing saved teams:', error);
      }
    }
    else {
      this.SavedTeams = [];
    }

    console.log("Loading team:", this.SavedTeams);

    watch(this.SavedTeams, (newVal) => {
      localStorage.setItem('savedTeams', JSON.stringify(newVal));
    }, { deep: true });
  }

  SaveTeam(team) {
    if(!team) team = new Team();
    if(team instanceof Array) {
      team = new Team({ Name: "Unnamed Team"}, ...team);
    }
    if(!team instanceof Team) {
      console.error("Invalid teamBuilder instance provided to SaveTeam.");
      return;
    }

    let builderId = team.Id || team.Name;
    let existingIndex = this.SavedTeams.findIndex(t => t.Id === builderId || t.Name === builderId);
    // if(existingIndex >= 0) {
    //   this.SavedTeams[existingIndex] = team;
    // } else {
    //   this.SavedTeams.push(team);
    // }
    localStorage.setItem('savedTeams', JSON.stringify(this.SavedTeams));
  }

  GetTeam(identifier) {
    if(identifier === undefined || identifier === null) {
      let teamId = localStorage.getItem('lastUsedTeamId');
      if(teamId) {
        identifier = teamId;
      }
      else return this.SavedTeams[0] || null; // return first team if still no identifier
    }
    let team = this.SavedTeams.find(t => t.Id === identifier || t.Name === identifier);
    team = team || this.SavedTeams[0] || null; // Fallback to first team if not found
    return team;
  }

  NewTeam(name) {
    if(!name) name = "New #" + (this.SavedTeams.length + 1);
    let team = new Team({ Name: name });
    this.SavedTeams.push(team);
    localStorage.setItem('savedTeams', JSON.stringify(this.SavedTeams));
    return team;
  }

  DeleteTeam(team) {
    let confirm = window.confirm(`Are you sure you want to delete the team "${team.Name}"? This action cannot be undone.`);
    if (!confirm) return;
    this.SavedTeams = this.SavedTeams.filter(t => t.Id !== team.Id);
    localStorage.setItem('savedTeams', JSON.stringify(this.SavedTeams));
    console.log("Deleted team:", team);
  }
}

class Team{
  constructor(data) {
    Object.assign(this, data);
    if(data.PokemonList) {
      // Edge case to handle old format where only PokemonList was saved
      this.PokemonList = reactive(pkmn.ParsePokemonList(data.PokemonList) || new Array(0));
    }
    else {
      this.PokemonList = reactive(new Array(0));
    }
    
    this.EditingName = ref(false);
    
    if(!this.Id) {
      this.Id = this.generateId();
    }
  }

  generateId() {
    return 'team-' + Math.random().toString(36).substr(2, 9);
  }

  getList() {
    return [...this];
  }

  toggleEditingName() {
    this.EditingName = !this.EditingName;

    // Focus input if entering edit mode
    setTimeout(() => {
      let inputElement = document.querySelector(`#${this.Id} input`);
      if (this.EditingName && inputElement) {
        inputElement.focus();
      }
    }, 50);
  }
}

class TeamBuilder {
  constructor() {
    this.Loader = new TeamLoader();
    this.team = this.Loader.GetTeam();
    this.teamList = this.team?.PokemonList || reactive(new Array(0));

    this.TeamEffectiveness = this.getTeamEffectiveness();
    this.TeamEffectivenessChart = this.getTeamEffectiveness(true); // For unique type matchups

    // Ensure the team always has 6 slots (filled with null if less than 6)
    this.filteredTeam = computed(() => {
      if(this.teamList.length < 6) {
        return [...this.teamList, ...new Array(6 - this.teamList.length).fill(null)];
      }
      return this.teamList;
    });
  }

  addPokemon(pokemon) {
    if(!this.team) {
      this.team = this.Loader.NewTeam();
      this.teamList = this.team.PokemonList;
    }

    if(!pokemon.TypeMatchups) {
      pokemon.GetTypeMatchups(typeChart); // Fetch and populate type matchups if not already done
    }

    if(!pokemon.MoveList || pokemon.MoveList.length === 0) {
      pokemon.GetMoves(moveList); // Fetch and populate moves if not already done

    }
    if(!pokemon.TMMoves || pokemon.TMMoves.length === 0) {
      let list = TMList.filter(tm => pokemon.TutorMoves?.includes(tm.Move) );
      list = moveList.filter(mv => list.some(t => t.Move === mv.Name));
      
      pokemon.ParseTMMoves(list);
    }

    if (this.teamList.length < 6) {
      console.log("Pokemon prior to cloning:", pokemon);
      pokemon = pokemon.Clone(); // Create a deep copy to avoid reference issues
      pokemon.TeamIndex = this.teamList.length + 1; // Assign TeamIndex based on current team size

      console.log("Adding Pokémon to team:", pokemon, "with TeamIndex:", pokemon.TeamIndex);
      this.teamList.push(pokemon);
    } else {
      console.log("Team is full!");
    }
  }

  removePokemon(pokemon) {
    this.team.PokemonList = this.team?.PokemonList.filter(p => p.TeamIndex != pokemon.TeamIndex) || reactive(new Array(0));
    this.teamList = this.team.PokemonList;

    // Reassign TeamIndex values
    this.teamList.forEach((p, index) => {
      p.TeamIndex = index + 1;
    });
  }

  getTeam() {
    return this.teamList;
  }
  
  // Used in TeamEffectiveness tab to calculate overall team type matchups
  getTeamEffectiveness(unique = false) {
    let allWeaknesses = [];
    let allResistances = [];
    let allImmunities = [];

    this.teamList.forEach(pokemon => {
      if (pokemon.TypeMatchups && unique) {
        allWeaknesses.push(...pokemon.TypeMatchups.weaknesses.unique());
        allResistances.push(...pokemon.TypeMatchups.resistances.unique());
        allImmunities.push(...pokemon.TypeMatchups.immunities.unique());
      }
      else if(pokemon.TypeMatchups) {
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
    this.Loader.SaveTeam(this.team);
    localStorage.setItem('lastUsedTeamId', this.team.Id);
  }

  loadTeam(team) {
    if(team == null || !(team instanceof Team)) {
      return;
    }
    this.team = team;
    this.teamList = team.PokemonList;
    localStorage.setItem('lastUsedTeamId', team.Id);
  }

  deleteTeam(team) {
    this.Loader.DeleteTeam(team);
    this.team = this.Loader.GetTeam();
    this.teamList = this.team?.PokemonList || reactive(new Array(0));
    localStorage.removeItem('lastUsedTeamId');
  }

  newTeam(name) { 
    let team = this.Loader.NewTeam(name);
    this.team = team;
    this.teamList = team.PokemonList;
  }
}

class Dashboard {
  constructor(teamBuilder) {
    this.teamBuilder = teamBuilder;

    this.effectivenessChartOptions = computed(() => {
      return this.TypeEffectivenessChart();
    });
    this.moveCoverageChartOptions = computed(() => {
      return this.MoveCoverageChart();
    });
  }

  GetTeamWeaknesses(type) {
    const chartData = this.teamBuilder.getTeamEffectiveness(true);
    return chartData.get(type)?.weaknesses || 0;
  }

  GetTeamResistances(type) {
    const chartData = this.teamBuilder.getTeamEffectiveness(true);
    let resistances = chartData.get(type)?.resistances || 0;
    let immunities = chartData.get(type)?.immunities || 0;
    let weaknesses = chartData.get(type)?.weaknesses || 0;
    let netResistances = resistances + immunities;
    return netResistances > 0 ? netResistances : 0;
  }

  GetTeamMoveCoverage(type) {
    let teamList = this.teamBuilder.teamList;
    let coverageData = {};
    typeChart.forEach(t => {
      coverageData[t.Name] = 0;
      teamList.forEach(pokemon => {
        if(pokemon.SelectedMoves.some(mv => t.Weaknesses?.includes(mv.Type) && mv.Category !== "Status")) {
          coverageData[t.Name] += 1;
        }
      });
    });
    return coverageData;
  }

  TypeEffectivenessChart() {
    const chartData = this.teamBuilder.getTeamEffectiveness(true); // Unique type matchups
    const chartDataEntries = Array.from(chartData.entries());

    let options = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: function (params) {
          let typeName = params[0].name;
          let values = chartData.get(typeName);
          let netEffectiveness = values.resistances + values.immunities - values.weaknesses;
          return `<strong>${typeName}</strong><br/>
                  Weaknesses: ${values.weaknesses}<br/>
                  Resistances: ${values.resistances}<br/>
                  Immunities: ${values.immunities}<br/>
                  <strong>Net Effectiveness: ${netEffectiveness}</strong>`;
        }
      },
      legend: {
        show: false
      },
      grid: {
        top: 0
      },
      xAxis: [
        {
          type: 'value',
          interval: 1
        }
      ],
      yAxis: [
        {
          type: 'category',
          axisTick: {
            show: false
          },
          data: Array.from(chartData.keys()),
          formatter: function (value) {
            return `<img src="./resources/images/types/${value}.png" alt="${value}" style="width:20px; height:20px; vertical-align:middle; margin-right:8px;">`;
          }
        }
      ],
      series: [
        {
          data: chartDataEntries.map(([typeName, values]) => {
            let netEffectiveness = values.resistances + values.immunities - values.weaknesses;
            return {
              name: typeName,
              value: netEffectiveness,
              itemStyle: {
                color: typeChart.find(t => t.Name === typeName)?.Colors?.main || '#888888'
              },
            };
          }),
          type: 'bar',
          label: {
            show: true,
            formatter: function (param) {
              if (param.value != 0 ) return param.value;
              return '';
            }
          },
          
        }
      ]
    }

    return options;
  }

  MoveCoverageChart() {
    let teamList = this.teamBuilder.getTeam();
    const coverageData = {};
    typeChart.forEach(type => {
      coverageData[type.Name] = 0;
      teamList.forEach(pokemon => {
        if(pokemon.SelectedMoves.some(mv => type.Weaknesses?.includes(mv.Type) && mv.Category !== "Status")) {
          coverageData[type.Name] += 1;
        }
      });
    });  

    let options = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        
      },
      legend: {
        show: false
      },
      grid: {
        top: 0
      },
      xAxis: [
        {
          type: 'value',
          interval: 1
        }
      ],
      yAxis: [
        {
          type: 'category',
          axisTick: {
            show: false
          },
          data: Object.keys(coverageData),
          formatter: function (value) {
            return `<img src="./resources/images/types/${value}.png" alt="${value}" style="width:20px; height:20px; vertical-align:middle; margin-right:8px;">`;
          }
        }
      ],
      series: [
        {
          data: Object.entries(coverageData).map(([typeName, value]) => {
            return {
              name: typeName,
              value: value,
              itemStyle: {
                color: typeChart.find(t => t.Name === typeName)?.Colors?.main || '#888888'
              },
            };
          }),
          type: 'bar',
          label: {
            show: true,
            formatter: function (param) {
              if (param.value != 0 ) return param.value;
              return '';
            }
          },
          
        }
      ]
    }
    return options;
  }

  GetTeamStatsChartOptions() {
    // To be implemented
  }
}

const app = createApp({
  setup() {
    const darkMode = ref(false);
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
    const includeEggMoves = ref(false);
    const includeTMMoves = ref(false);
    const dashboard = reactive(new Dashboard(teamBuilder));
    dashboard.MoveCoverageChart();

    const moveCategories = reactive([
      { Name: "Physical" },
      { Name: "Special" },
      { Name: "Status" }
    ]);
    const searching = ref(false);
    const currentlyViewing = ref(null);
    const tabView = ref("dashboard");
    const moveListTab = ref("levelup");
    const pokedexView = ref("");
    const sortingMethod = reactive({
      method: "number",
      subCategory: null,
      ascending: true
    });
    const pokedexTab = ref("info");
    const currentlyViewingMoveSearchQuery = ref("");
    
    // Check URL params for pokemon to view
    let urlParams = new URLSearchParams(window.location.search);
    let pokemonParam = urlParams.get('pokemon');
    if(pokemonParam) {
      pokedexView.value = pokemonParam;
    }
    
    // Used in pokedex to toggle ability immunity effects
    // E.g. Wonder Guard ability
    // Needed because typechart must be given to the pokemon to recalculate matchups
    const toggleAbilityImmunity = (pokemon) => {
      if(!pokemon) return;
      pokemon.ToggleAbilityImmunity();
      pokemon.GetTypeMatchups(types);
    };

    // Filter for mons based on search and selected filters in pokedex
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
        filtered = filtered.filter(p => moveFilter.value.every(mv => {
          if(!includeEggMoves.value && !includeTMMoves.value) {
            return p.Moves.includes(mv.Name);
          }

          let hasMove = p.Moves.includes(mv.Name);
          if(!hasMove && includeEggMoves.value) {
            if(!p.EggMovesList || p.EggMovesList.length === 0) {
              p.EggMovesList = getEggMoves(p);
            }
            hasMove = p.EggMovesList?.some(em => em.Name === mv.Name);
          }
          if(!hasMove && includeTMMoves.value) {
            if(!p.TMMoves || p.TMMoves.length === 0) {
              let list = TMList.filter(tm => p.TutorMoves?.includes(tm.Move) );
              list = moveList.filter(mv => list.some(t => t.Move === mv.Name));
              p.ParseTMMoves(list);
            }
            hasMove = p.TMMoves?.some(tm => tm.Name === mv.Name);
          }
          return hasMove;
        }));
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

    const toggleDarkMode = () => {
      darkMode.value = !darkMode.value;
      localStorage.setItem('darkMode', darkMode.value ? 'true' : 'false');
    }

    const getPokemonTypeStyle = (pokemon, isLight = false) => {
      let suffix = isLight ? "-type-color-light" : "-type-color";
      if(!pokemon || !pokemon.Types || pokemon.Types.length === 0) {
        return {
          '--primary-color': `var(--normal${suffix})`,
          '--secondary-color': `var(--normal${suffix})`
        }
      }
      return {
        '--primary-color': `var(--${pokemon.Types[0]?.toLowerCase()}${suffix})`,
        '--secondary-color': pokemon.Types[1] ? `var(--${pokemon.Types[1]?.toLowerCase()}${suffix})` : `var(--${pokemon.Types[0]?.toLowerCase()}${suffix})`
      }
    }

    const viewPokemon = computed(() => {
      if(currentlyViewing.value === null) return null;
      let mon = teamBuilder.teamList.find(p => p.InternalName === currentlyViewing.value) || null;
      return mon;
    });

    const getAbilityByName = (name) => {
      return allAbilities.find(a => a.Name?.normalizeName() === name?.normalizeName()) || null;
    };
    
    const toggleViewingPokemon = (pokemon) => {
      moveListTab.value = "levelup";
      if(pokemon != null && viewPokemon.value && pokemon.InternalName === viewPokemon.value.InternalName) {
        currentlyViewing.value = null;
      } else if(pokemon != null) {
        currentlyViewing.value = pokemon.InternalName;
        tabView.value = "team";
      }
      else {
        currentlyViewing.value = null;
        tabView.value = "team";
      }
    }

    const filterCurrentlyViewingMoveList = (moveList) => {
      if(!currentlyViewingMoveSearchQuery.value || currentlyViewingMoveSearchQuery.value.length === 0) {
        return moveList;
      }
      return moveList.filter(mv => mv.Name.toLowerCase().includes(currentlyViewingMoveSearchQuery.value.toLowerCase()));
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
      
      if (pokedexView.value === "" || pokedexView.value === null) {
        // Reset URL param if no mon selected
        const url = new URL(window.location);
        url.searchParams.delete('pokemon');
        window.history.replaceState({}, '', url.toString());
        
        return null;
      }

      let pokemon = allPokemon.find(p => p.InternalName === pokedexView.value);
      if(!pokemon) {
        // Reset URL param if no mon is found
        const url = new URL(window.location);
        url.searchParams.delete('pokemon');
        window.history.replaceState({}, '', url.toString())
        
        return null;
      }

      if(!pokemon.TypeMatchups) {
        pokemon.GetTypeMatchups(typeChart); // Fetch and populate type matchups if not already done
      }
      if(!pokemon.MoveList || pokemon.MoveList.length === 0) {
        pokemon.GetMoves(moveList); // Fetch and populate moves if not already done
      }

      if(!pokemon.TMMoves || pokemon.TMMoves.length === 0) {
        let list = TMList.filter(tm => pokemon.TutorMoves?.includes(tm.Move) );
        list = moveList.filter(mv => list.some(t => t.Move === mv.Name));
        
        if(list.length > 0) { // Only parse if there are TM moves available, otherwise causes issues (recursion)
          pokemon.ParseTMMoves(list);
        }
      }

      console.log("Viewing Pokémon:", pokemon);
      pokedexTab.value = "info";

      // Set url params to pokemon
      const url = new URL(window.location);
      url.searchParams.set('pokemon', pokemon.InternalName);
      window.history.replaceState({}, '', url.toString());

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

      let urlParams = new URLSearchParams(window.location.search);
      urlParams.set('tab', tabName);
      const url = new URL(window.location);
      url.search = urlParams.toString();
      window.history.replaceState({}, '', url.toString());
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
        if(!pokemon || !pokemon.EggMoves || pokemon.EggMoves.length === 0) return [];
        
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

    const pageTitle = computed(() => {
      let title = "Vanguard Pokédex";
      let currentTab = tabView.value;
      if(currentTab === "dashboard") {
        return title + " - Dashboard";
      }
      if(currentTab === "team") {
        return title + " - Team Builder";
      }
      else return currentTab.FromCaseToSpace();
    });

    watch(viewPokemon, (newVal) => {
      if(newVal != null && newVal.Name) {
        teamBuilder.saveTeam();
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

      let mode = localStorage.getItem('darkMode');
      if(mode === 'true') {
        darkMode.value = true;
      } else {
        darkMode.value = false;
      }

      let urlParams = new URLSearchParams(window.location.search);
      let tabParam = urlParams.get('tab');
      if(tabParam) {
        setTabView(tabParam);
      }
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
      effectiveTypeFilter,
      includeEggMoves,
      includeTMMoves,
      pageTitle,
      getPokemonTypeStyle,
      filterCurrentlyViewingMoveList,
      currentlyViewingMoveSearchQuery,
      dashboard,
      darkMode,
      toggleAbilityImmunity,
      toggleDarkMode
    };
  }
});

app.component('search-dropdown', comp.SearchDropdown);

// Apache Echart directive for app
app.directive('chart', {
  beforeMount(el, binding, vnode, prevVnode) {
    const myChart = echarts.init(el);
    const options = binding.value.options;
    myChart.setOption(options);

    // set chart to element for later access
    el._echart_instance = myChart;

    window.addEventListener('resize', () => {
      myChart.resize();
    });

    myChart.resize();

  },

  mounted(el, binding) {
    el._echart_instance.resize();
  },

  beforeUpdate(el, binding) {
  },

  updated(el, binding) {
    el.style.backgroundColor = binding.value || 'yellow';
    let options = binding.value.options;
    let  myChart = el._echart_instance;

    myChart.setOption(options);

    myChart.resize();
  },

  beforeUnmount(el, binding) {
  },

  unmounted(el, binding) {
  }
});

app.mount("#app");

