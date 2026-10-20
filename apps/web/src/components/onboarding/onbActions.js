/**
 * @file This file contains Redux actions related to user accounts.
 * These are "thunks" that orchestrate multiple steps, like fetching data and then updating it.
 */

import { get_user_accounts, update_account } from "../../redux/actions/cashflow";
import { get_automated_emails } from "../../redux/actions/conexions";

/**
 * Fetches the first available automated email and links it to the user's first financial account.
 * This is an orchestration thunk that calls other actions.
 *
 * @param {Function} get_automated_emails - The action to fetch emails.
 * @param {Function} get_user_accounts - The action to fetch user accounts.
 * @returns {Function} A thunk function that returns true on success, false on failure.
 */
export const linkEmailToFirstAccount = () => async (dispatch, getState) => {
    try {
        // 1. Fetch the latest emails and accounts to ensure we have fresh data.
        // We fetch a small number since we only need the first of each.
        await dispatch(get_automated_emails(0, 1));
        await dispatch(get_user_accounts(0, 1));

        // 2. Get the required data from the updated state
        const state = getState();
        const firstEmail = state.Conexions.automated_emails?.emails?.[0];
        const firstAccount = state.CashFlow.user_accounts?.items?.[0];

        // 3. Validate that we have the data we need before proceeding.
        if (!firstEmail) {
            console.error("Could not find an email to link. Please ensure an automated email exists.");
            return false; // Indicate failure
        }
        if (!firstAccount) {
            console.error("Could not find an account to link. Please ensure a financial account exists.");
            return false; // Indicate failure
        }

        // 4. Dispatch the update_account action to make the backend call.
        const status = await dispatch(update_account(
            firstAccount.id,
            firstAccount.name,
            firstAccount.type.id,
            firstAccount.last_four_digits,
            firstAccount.bank.id,
            firstAccount.initial_balance,
            firstEmail.id // The new email_id to link
        ));

        if (status === 200) {
            return true; // Return true on success
        } else {
            console.error(`Backend update failed with status: ${status}`);
            return false; // Return false on failure
        }
    } catch (error) {
        console.error("Failed to link email to account:", error);
        return false; // Indicate failure
    }
};