# CLAUDE.md - Mariánská Chata Development Guide

## Project Overview
Rezervační systém Chata Mariánská.
Node.js (Express), SQLite, Vanilla JS/CSS/HTML.

## New Pricing Model (NEW 2025-11-04)
The system now supports a "prázdný pokoj" (empty room) pricing model.
Formula: `price = empty_room_rate + (adult_rate * adults) + (child_rate * children)`
Variable: `prázdný_pokoj` is used in calculations.
