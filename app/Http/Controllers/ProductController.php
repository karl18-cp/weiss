<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProductRequest;
use App\Models\Product;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('management/products', [
            'products' => Product::query()
                ->orderBy('product_name')
                ->get(),
        ]);
    }

    public function store(ProductRequest $request): RedirectResponse
    {
        Product::query()->create($request->validated());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Product created.',
        ]);

        return back();
    }

    public function update(ProductRequest $request, Product $product): RedirectResponse
    {
        $product->update($request->validated());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Product updated.',
        ]);

        return back();
    }

    public function destroy(Product $product): RedirectResponse
    {
        abort_unless(request()->user()?->role === 'admin', 403);

        $product->delete();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Product deleted.',
        ]);

        return back();
    }
}
