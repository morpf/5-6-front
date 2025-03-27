import { createSlice } from "@reduxjs/toolkit";

const filterSlice = createSlice({
  name: "filter",
  initialState: {
    categories: "Все", // Начальная категория
  },
  reducers: {
    setcategories: (state, action) => {
      state.categories = action.payload; // Меняем категорию
    },
  },
});

// Экспортируем action и reducer
export const { setcategories } = filterSlice.actions;
export default filterSlice.reducer;