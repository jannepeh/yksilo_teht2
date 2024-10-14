'use strict';
import {restaurantModal, restaurantRow} from './components';
import {fetchData} from './fetchData';
import {apiURL} from './variables';

const kohde = document.querySelector('tbody') as HTMLTableSectionElement;
const modaali = document.querySelector('dialog') as HTMLDialogElement;
const info = document.querySelector('#info') as HTMLElement;
const closeModal = document.querySelector('#close-modal') as HTMLElement;

const kutsuRavintolat = async () => {
  const restaurants = await fetchRestaurants();
  teeRavintolaLista(restaurants);
};

// avatun ravintolan objekti tallentuu tähän
let openedRestaurant = {} as Restaurant;
let showWeekly = false; // Toggle to switch between daily and weekly menu

// Initialize the application on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('search-button')
    ?.addEventListener('click', handleSearch);

  loadRestaurants();

  // Event listeners for showing daily or weekly menu
  document.getElementById('show-weekly-menu')?.addEventListener('click', () => {
    showWeekly = true;
    updateMenuDisplay(); // Update menu display based on the new state
  });

  document.getElementById('show-daily-menu')?.addEventListener('click', () => {
    showWeekly = false;
    updateMenuDisplay(); // Update menu display based on the new state
  });
});

// Function to update the menu display
async function updateMenuDisplay() {
  const weeklyMenu = document.getElementById('weekly-menu');
  const dailyMenu = document.getElementById('daily-menu');

  if (showWeekly) {
    weeklyMenu?.classList.remove('hidden');
    dailyMenu?.classList.add('hidden');
    await displayWeeklyMenu(openedRestaurant._id);
  } else {
    weeklyMenu?.classList.add('hidden');
    dailyMenu?.classList.remove('hidden');
    await displayDailyMenu(openedRestaurant._id, openedRestaurant);
  }
}

// Function for searching restaurants
function handleSearch(): void {
  const searchInput = (
    document.getElementById('search-input') as HTMLInputElement
  ).value.toLowerCase();
  const rows = document.querySelectorAll('tbody tr');

  rows.forEach((row) => {
    const cells = row.querySelectorAll('td');
    const [name, company, address] = Array.from(cells).map(
      (cell) => cell.textContent?.toLowerCase() || ''
    );

    if (
      name.includes(searchInput) ||
      company.includes(searchInput) ||
      address.includes(searchInput)
    ) {
      (row as HTMLElement).style.display = '';
    } else {
      (row as HTMLElement).style.display = 'none';
    }
  });
}

// Function for fetching restaurants
async function fetchRestaurants(): Promise<Restaurant[]> {
  try {
    const response = await fetch(apiURL + '/api/v1/restaurants');
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch restaurants:', error);
    return [];
  }
}

// Load restaurants and populate the table
async function loadRestaurants(): Promise<void> {
  const restaurants = await fetchRestaurants();
  restaurants.forEach((restaurant) => {
    const {_id, name, company, address} = restaurant;
    const row = restaurantRow({name, company, address});
    (row as HTMLElement).dataset.id = _id;
    kohde.appendChild(row);
  });
}

// Load restaurant list
document.addEventListener('DOMContentLoaded', kutsuRavintolat);

// Populate restaurant table with rows
const teeRavintolaLista = (restaurants: Restaurant[]): void => {
  kohde.innerHTML = '';

  restaurants.sort((a, b) => a.name.localeCompare(b.name));

  restaurants.forEach((restaurant) => {
    if (restaurant) {
      const {_id} = restaurant;

      const rivi = restaurantRow(restaurant);
      rivi.addEventListener('click', async () => {
        // Update openedRestaurant with the clicked restaurant's data
        openedRestaurant = restaurant;

        modaali.showModal();
        info.innerHTML = '<div>Ladataan...</div>';

        const korostetut = document.querySelectorAll('.highlight');
        korostetut.forEach((korostettu) => {
          korostettu.classList.remove('highlight');
        });

        rivi.classList.add('highlight');

        try {
          if (showWeekly) {
            await displayWeeklyMenu(_id);
          } else {
            await displayDailyMenu(_id, restaurant);
          }
        } catch (error) {
          console.error('Error fetching menu:', error);
          info.innerHTML = '<div>Virhe ladattaessa ruokalistaa.</div>';
        }
      });

      kohde.append(rivi);
    }
  });
};

closeModal.addEventListener('click', () => {
  modaali.close();
});

// Display Daily Menu
async function displayDailyMenu(_id: string, restaurant: Restaurant) {
  const paivanLista = await fetchData<DailyMenu>(
    apiURL + `/api/v1/restaurants/daily/${_id}/fi`
  );

  const currentDate = new Date().toLocaleDateString('fi-FI', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const menuItems = paivanLista.courses.map((course: Course) => ({
    name: course.name,
    price: course.price,
    diets: course.diets || '',
  }));

  const ravintolaHTML = restaurantModal(restaurant, menuItems);

  info.innerHTML = '';
  info.insertAdjacentHTML('beforeend', `<p>${currentDate}</p>${ravintolaHTML}`);
}

// Fetch and display Weekly Menu
async function displayWeeklyMenu(restaurantId: string): Promise<void> {
  try {
    const daysOfWeek = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    let menuHTML = '';

    for (const day of daysOfWeek) {
      const dailyMenu = await fetchDailyMenuForDay(restaurantId, day);
      menuHTML += `<h4>${day}</h4>`;

      if (dailyMenu.courses.length === 0) {
        menuHTML += '<div>No menu available</div>';
      } else {
        dailyMenu.courses.forEach((course) => {
          menuHTML += `
            <div>
              <p><strong>${course.name || 'Ei ilmoitettu'}</strong></p>
              <p>Hinta: ${course.price || 'Ei ilmoitettu'}</p>
              <p>Allergeenit: ${course.diets || 'Ei ilmoitettu'}</p>
            </div>
          `;
        });
      }
    }

    info.innerHTML = menuHTML;
  } catch (error) {
    console.error('Error displaying weekly menu:', error);
    info.innerHTML = '<div>Virhe ladattaessa viikon ruokalistaa.</div>';
  }
}

// Fetch Daily Menu for a specific day
async function fetchDailyMenuForDay(
  restaurantId: string,
  day: string
): Promise<DailyMenu> {
  try {
    const response = await fetchData<DailyMenu>(
      apiURL + `/api/v1/restaurants/daily/${restaurantId}/fi?day=${day}`
    );
    return response;
  } catch (error) {
    console.error(`Failed to fetch daily menu for ${day}:`, error);
    return {courses: []};
  }
}

// Define interfaces for type safety
interface Restaurant {
  _id: string;
  companyId: string;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  location: {
    type: string;
    coordinates: [number, number];
  };
  company: string;
}

interface DailyMenu {
  courses: Course[];
}

interface Course {
  name: string;
  price: string;
  diets?: string;
}

// Toggle darkmode
const checkbox = document.getElementById('checkbox') as HTMLInputElement;
checkbox.addEventListener('change', () => {
  document.body.classList.toggle('dark');
});
